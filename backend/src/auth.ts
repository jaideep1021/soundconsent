import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { Config } from "./config.js";
import type { JsonStore } from "./store.js";
import type { Account, AuthGrant, AuthState } from "./types.js";
import { HttpError } from "./errors.js";

const COORDINATOR_COOKIE = "sc_coordinator";
const PATIENT_COOKIE = "sc_patient";
const HOURS = 60 * 60 * 1000;
export const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const patientCookie = (id: string) => `sc_review_${digest(id).slice(0, 16)}`;
const publicAccount = (account: Account) => ({ id: account.id, email: account.email, name: account.name, role: account.role, studyIds: account.studyIds, disabled: account.disabled });
export type Principal = { account: Omit<Account, "passwordHash">; grantHash?: string };
const keyBytes = (value: string, salt: string): Promise<Buffer> => new Promise((resolve, reject) => {
  scrypt(value, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, derived) => error ? reject(error) : resolve(derived));
});
export async function hashPassword(value: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${(await keyBytes(value, salt)).toString("hex")}`;
}
async function verify(value: string, hash: string): Promise<boolean> {
  const [salt, encoded] = hash.split(":");
  if (!salt || !encoded || !/^[a-f0-9]{128}$/.test(encoded)) return false;
  return timingSafeEqual(await keyBytes(value, salt), Buffer.from(encoded, "hex"));
}
function cookie(request: FastifyRequest, name: string): string | undefined {
  return request.headers.cookie?.split(";").map((s) => s.trim()).find((s) => s.startsWith(`${name}=`))?.slice(name.length + 1);
}
const legacyAccount: Omit<Account, "passwordHash"> = { id: "legacy-api-key", email: "", name: "Legacy API key", role: "admin", studyIds: [], disabled: false };

export class AuthService {
  private dummyHash = "";
  private attempts = new Map<string, { count: number; until: number }>();
  constructor(private store: JsonStore, private config: Config) {}

  async init() {
    this.dummyHash = await hashPassword(randomBytes(32).toString("hex"));
    if (!this.store.getAuth().accounts.length && this.config.bootstrapEmail && this.config.bootstrapPassword) {
      await this.createAccount({ email: this.config.bootstrapEmail, password: this.config.bootstrapPassword, name: "Administrator", role: "admin", studyIds: [] });
    }
  }
  checkOrigin(request: FastifyRequest, required = false) {
    const origin = request.headers.origin;
    if ((required && !origin) || (origin && !this.config.corsOrigins.includes(origin))) throw new HttpError(403, "Request origin is not allowed");
  }
  private rateLimit(...keys: string[]) {
    const now = Date.now();
    for (const [key, value] of this.attempts) if (value.until < now) this.attempts.delete(key);
    if (this.attempts.size > 10000) throw new HttpError(429, "Too many sign-in attempts. Try again later.");
    for (const key of keys) {
      const bucket = this.attempts.get(key) ?? { count: 0, until: now + 15 * 60 * 1000 };
      if (++bucket.count > 10) throw new HttpError(429, "Too many sign-in attempts. Try again later.");
      this.attempts.set(key, bucket);
    }
  }
  private setCookie(reply: FastifyReply, name: string, token: string, seconds: number) {
    reply.header("Set-Cookie", `${name}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${seconds}${this.config.secureCookies ? "; Secure" : ""}`);
  }
  private activeGrant(token: string | undefined, kind: AuthGrant["kind"]): AuthGrant | undefined {
    if (!token || token.length > 256) return;
    const grant = this.store.getAuth().grants.find((g) => g.hash === digest(token) && g.kind === kind && g.expiresAt > Date.now());
    if (!grant) return;
    if (grant.patientId && !this.store.getAuth().patients?.some((p) => p.id === grant.patientId)) return;
    if (grant.accountId && !this.store.getAuth().accounts.some((a) => a.id === grant.accountId && !a.disabled)) return;
    if (grant.parentHash && !this.store.getAuth().grants.some((g) => g.hash === grant.parentHash && g.expiresAt > Date.now())) return;
    return grant;
  }
  coordinator(request: FastifyRequest): Principal {
    const supplied = request.headers.authorization;
    if (supplied) {
      if (this.config.allowLegacyApiKey && this.config.coordinatorApiKey && timingSafeEqual(Buffer.from(digest(supplied)), Buffer.from(digest(`Bearer ${this.config.coordinatorApiKey}`)))) return { account: legacyAccount };
      throw new HttpError(401, "Coordinator authentication required");
    }
    const grant = this.activeGrant(cookie(request, COORDINATOR_COOKIE), "coordinator");
    const account = this.store.getAuth().accounts.find((a) => a.id === grant?.accountId && !a.disabled);
    if (!grant || !account) throw new HttpError(401, "Coordinator authentication required");
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) this.checkOrigin(request, true);
    return { account: publicAccount(account), grantHash: grant.hash };
  }
  admin(request: FastifyRequest): Principal {
    const principal = this.coordinator(request);
    if (principal.account.role !== "admin") throw new HttpError(403, "Administrator access required");
    return principal;
  }
  canAccess(principal: Principal, studyId: string) {
    return principal.account.role === "admin" || principal.account.studyIds.includes(studyId);
  }
  study(request: FastifyRequest, studyId: string): Principal {
    const principal = this.coordinator(request);
    if (!this.canAccess(principal, studyId)) throw new HttpError(403, "Study access denied");
    return principal;
  }
  session(request: FastifyRequest, id: string): { kind: "patient" | "coordinator"; grantHash?: string; accountId?: string; patientId?: string } {
    const patient = this.patientPrincipal(request);
    if (patient && this.store.getAuth().memberships?.some((m) => m.patientId === patient.user.id && m.sessionId === id)) {
      return { kind: "patient", grantHash: patient.grant.hash, patientId: patient.user.id };
    }
    const grant = this.activeGrant(cookie(request, patientCookie(id)), "patient");
    if (grant?.sessionId === id) {
      if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) this.checkOrigin(request, true);
      return { kind: "patient", grantHash: grant.hash, ...(grant.accountId ? { accountId: grant.accountId } : {}) };
    }
    const principal = this.coordinator(request);
    const session = this.store.getSession(id);
    if (!session) throw new HttpError(404, "Session not found");
    if (!this.canAccess(principal, session.studyId)) throw new HttpError(403, "Study access denied");
    return { kind: "coordinator", ...(principal.grantHash ? { grantHash: principal.grantHash } : {}), ...(principal.account.id !== legacyAccount.id ? { accountId: principal.account.id } : {}) };
  }
  private patientPrincipal(request: FastifyRequest) {
    const grant = this.activeGrant(cookie(request, PATIENT_COOKIE), "patient_account");
    const patient = this.store.getAuth().patients?.find((p) => p.id === grant?.patientId);
    if (!grant || !patient) return;
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) this.checkOrigin(request, true);
    return { user: { id: patient.id, username: patient.username }, grant };
  }
  patient(request: FastifyRequest) {
    const principal = this.patientPrincipal(request);
    if (!principal) throw new HttpError(401, "Patient sign in required");
    return principal.user;
  }
  async patientLogin(request: FastifyRequest, reply: FastifyReply, username: unknown, password: unknown, register = false) {
    this.checkOrigin(request, true);
    if (typeof username !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]{2,39}$/.test(username.trim()) || typeof password !== "string" || password.length > 256 || (register && password.length < 12)) throw new HttpError(400, "Use a 3–40 character username (letters, numbers, dots, underscores or hyphens) and a 12–256 character password");
    const normalized = username.trim().toLowerCase();
    this.rateLimit(`patient-ip:${request.ip}`, `patient-name:${digest(normalized)}`);
    let patient = this.store.getAuth().patients?.find((p) => p.username === normalized);
    const token = randomBytes(32).toString("base64url");
    const old = cookie(request, PATIENT_COOKIE);
    if (register) {
      const passwordHash = await hashPassword(password);
      patient = { id: randomUUID(), username: normalized, passwordHash };
    } else {
      const valid = await verify(password, patient?.passwordHash ?? this.dummyHash);
      if (!valid || !patient) throw new HttpError(401, "Username or password is incorrect");
    }
    const saved = patient!;
    await this.store.updateAuth((auth) => {
      auth.patients ??= [];
      if (register) {
        if (auth.patients.some((p) => p.username === normalized)) throw new HttpError(409, "That username is already taken");
        auth.patients.push(saved);
      }
      this.prune(auth);
      if (old) this.removeGrant(auth, digest(old));
      auth.grants.push({ hash: digest(token), kind: "patient_account", patientId: saved.id, expiresAt: Date.now() + 24 * HOURS });
    });
    this.attempts.delete(`patient-ip:${request.ip}`);
    this.attempts.delete(`patient-name:${digest(normalized)}`);
    this.setCookie(reply, PATIENT_COOKIE, token, 24 * 3600);
    return { user: { id: saved.id, username: saved.username } };
  }
  async patientLogout(request: FastifyRequest, reply: FastifyReply) {
    this.checkOrigin(request, true);
    const token = cookie(request, PATIENT_COOKIE);
    if (token) await this.store.updateAuth((auth) => this.removeGrant(auth, digest(token)));
    this.setCookie(reply, PATIENT_COOKIE, "", 0);
  }
  private attachPatient(auth: AuthState, patientId: string, sessionId: string) {
    auth.memberships ??= [];
    const existing = auth.memberships.find((m) => m.sessionId === sessionId);
    if (existing && existing.patientId !== patientId) throw new HttpError(409, "This review is already assigned to a patient. Revoke access before assigning someone else.");
    if (!existing) auth.memberships.push({ patientId, sessionId, invitedAt: new Date().toISOString() });
    // Replace temporary review credentials with durable account access.
    auth.invitations = auth.invitations.filter((i) => i.sessionId !== sessionId);
    auth.grants = auth.grants.filter((g) => g.sessionId !== sessionId);
  }
  async claimPatientReview(request: FastifyRequest, id: string) {
    const patient = this.patient(request);
    const grant = this.activeGrant(cookie(request, patientCookie(id)), "patient");
    await this.store.updateAuth((auth) => {
      if (auth.memberships?.some((m) => m.patientId === patient.id && m.sessionId === id)) return;
      if (!grant || grant.sessionId !== id || !auth.grants.some((g) => g.hash === grant.hash && g.expiresAt > Date.now()) || (grant.accountId && !auth.accounts.some((a) => a.id === grant.accountId && !a.disabled))) throw new HttpError(403, "Open your invitation and enter its code to add this study");
      this.attachPatient(auth, patient.id, id);
    });
  }
  async invitePatient(sessionId: string, username: unknown) {
    if (typeof username !== "string" || username.length > 40) throw new HttpError(400, "Patient username is required");
    await this.store.updateAuth((auth) => {
      const patient = auth.patients?.find((p) => p.username === username.trim().toLowerCase());
      if (!patient) throw new HttpError(404, "No patient account has that username. Ask the patient to create an account, or share a first-time invitation.");
      this.attachPatient(auth, patient.id, sessionId);
    });
  }
  patientStudies(request: FastifyRequest) {
    const patient = this.patient(request);
    return (this.store.getAuth().memberships ?? []).filter((m) => m.patientId === patient.id).flatMap((m) => {
      const session = this.store.getSession(m.sessionId);
      if (!session) return [];
      const document = session.documentSnapshot ?? this.store.getDocument(session.documentId);
      return [{ sessionId: session.id, studyId: session.studyId, title: document?.title ?? "Study review", status: session.status, invitedAt: m.invitedAt, isNew: !m.openedAt, reviewedSections: session.results.length, totalSections: document?.sections.length ?? 0 }];
    }).sort((a, b) => b.invitedAt.localeCompare(a.invitedAt));
  }
  async openPatientStudy(request: FastifyRequest, id: string) {
    const patient = this.patient(request);
    await this.store.updateAuth((auth) => {
      const membership = auth.memberships?.find((m) => m.patientId === patient.id && m.sessionId === id);
      if (!membership) throw new HttpError(403, "Study access denied");
      membership.openedAt ??= new Date().toISOString();
    });
  }
  async createAccount(input: { email?: unknown; password?: unknown; name?: unknown; role?: unknown; studyIds?: unknown }) {
    const { email, password, name, role, studyIds } = input;
    if (typeof email !== "string" || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || typeof password !== "string" || password.length < 12 || password.length > 256 || typeof name !== "string" || !name.trim() || name.length > 120 || !["admin", "coordinator"].includes(String(role)) || !Array.isArray(studyIds) || studyIds.length > 100 || studyIds.some((s) => typeof s !== "string" || !/^[A-Za-z0-9._-]{1,100}$/.test(s))) throw new HttpError(400, "Provide email, name, a 12–256 character password, role and studyIds");
    const account: Account = { id: randomUUID(), email: email.trim().toLowerCase(), name: name.trim(), role: role as Account["role"], studyIds, disabled: false, passwordHash: await hashPassword(password) };
    await this.store.updateAuth((auth) => {
      if (auth.accounts.some((a) => a.email === account.email)) throw new HttpError(409, "Account already exists");
      auth.accounts.push(account);
    });
    return publicAccount(account);
  }
  accounts() { return this.store.getAuth().accounts.map(publicAccount); }
  async disable(id: string, actorId: string) {
    if (id === actorId) throw new HttpError(409, "Cannot disable your own account");
    await this.store.updateAuth((auth) => {
      const account = auth.accounts.find((a) => a.id === id);
      if (!account) throw new HttpError(404, "Account not found");
      account.disabled = true;
      auth.grants = auth.grants.filter((g) => g.accountId !== id);
      auth.invitations = auth.invitations.filter((i) => i.accountId !== id);
    });
  }
  async login(request: FastifyRequest, reply: FastifyReply, email: unknown, password: unknown) {
    this.checkOrigin(request);
    if (typeof email !== "string" || email.length > 254 || typeof password !== "string" || password.length > 256) throw new HttpError(400, "Email and password are required");
    const normalized = email.trim().toLowerCase();
    this.rateLimit(`ip:${request.ip}`, `email:${digest(normalized)}`);
    const account = this.store.getAuth().accounts.find((a) => a.email === normalized);
    const valid = await verify(password, account?.passwordHash ?? this.dummyHash);
    if (!valid || !account || account.disabled) throw new HttpError(401, "Email or password is incorrect");
    const token = randomBytes(32).toString("base64url");
    const old = cookie(request, COORDINATOR_COOKIE);
    await this.store.updateAuth((auth) => {
      if (!auth.accounts.some((a) => a.id === account.id && !a.disabled)) throw new HttpError(401, "Email or password is incorrect");
      this.prune(auth);
      if (old) this.removeGrant(auth, digest(old));
      auth.grants.push({ hash: digest(token), kind: "coordinator", accountId: account.id, expiresAt: Date.now() + 8 * HOURS });
    });
    this.attempts.delete(`ip:${request.ip}`);
    this.attempts.delete(`email:${digest(normalized)}`);
    this.setCookie(reply, COORDINATOR_COOKIE, token, 8 * 3600);
    return { user: publicAccount(account) };
  }
  async logout(request: FastifyRequest, reply: FastifyReply, id?: string) {
    this.checkOrigin(request, true);
    const name = id ? patientCookie(id) : COORDINATOR_COOKIE;
    const token = cookie(request, name);
    if (token) await this.store.updateAuth((auth) => this.removeGrant(auth, digest(token)));
    this.setCookie(reply, name, "", 0);
  }
  async invite(id: string, principal: Principal) {
    const token = randomBytes(32).toString("base64url");
    const accessCode = randomBytes(9).toString("base64url");
    const codeHash = await hashPassword(accessCode);
    const expiresAt = Date.now() + 7 * 24 * HOURS;
    await this.store.updateAuth((auth) => {
      this.prune(auth);
      if (auth.memberships?.some((m) => m.sessionId === id)) throw new HttpError(409, "This review is already connected to a patient account");
      auth.invitations = auth.invitations.filter((i) => i.sessionId !== id);
      auth.invitations.push({ hash: digest(token), codeHash, sessionId: id, expiresAt, ...(principal.account.id !== legacyAccount.id ? { accountId: principal.account.id } : {}) });
    });
    return { sessionId: id, invitationToken: token, accessCode, expiresAt: new Date(expiresAt).toISOString() };
  }
  async exchange(request: FastifyRequest, reply: FastifyReply, id: string, token: unknown, accessCode: unknown, requirePatient = false) {
    this.checkOrigin(request);
    if (typeof token !== "string" || token.length > 256 || typeof accessCode !== "string" || accessCode.length > 256) throw new HttpError(400, "Invitation and access code are required");
    this.rateLimit(`ip:${request.ip}`, `invite:${digest(token)}`);
    const invitation = this.store.getAuth().invitations.find((i) => i.hash === digest(token) && i.sessionId === id);
    const valid = await verify(accessCode, invitation?.codeHash ?? this.dummyHash);
    if (!valid || !invitation || invitation.expiresAt <= Date.now()) throw new HttpError(401, "Invitation or access code is invalid or expired");
    const patient = this.patientPrincipal(request);
    if (requirePatient && !patient) throw new HttpError(401, "Patient sign in required");
    const patientToken = randomBytes(32).toString("base64url");
    const old = cookie(request, patientCookie(id));
    await this.store.updateAuth((auth) => {
      // Consume and grant atomically, including competing redemption/revocation.
      if (!auth.invitations.some((i) => i.hash === invitation.hash && i.expiresAt > Date.now()) || (invitation.accountId && !auth.accounts.some((a) => a.id === invitation.accountId && !a.disabled))) throw new HttpError(401, "Invitation or access code is invalid or expired");
      if (patient) {
        this.attachPatient(auth, patient.user.id, id);
        return;
      }
      auth.invitations = auth.invitations.filter((i) => i.hash !== invitation.hash);
      this.prune(auth);
      if (old) this.removeGrant(auth, digest(old));
      auth.grants.push({ hash: digest(patientToken), kind: "patient", sessionId: id, expiresAt: Date.now() + 24 * HOURS, ...(invitation.accountId ? { accountId: invitation.accountId } : {}) });
    });
    this.attempts.delete(`ip:${request.ip}`);
    if (!patient) this.setCookie(reply, patientCookie(id), patientToken, 24 * 3600);
    return { sessionId: id };
  }
  async revokeSession(id: string) {
    await this.store.updateAuth((auth) => {
      auth.memberships = (auth.memberships ?? []).filter((m) => m.sessionId !== id);
      auth.grants = auth.grants.filter((g) => g.sessionId !== id);
      auth.invitations = auth.invitations.filter((i) => i.sessionId !== id);
    });
  }
  async voiceToken(request: FastifyRequest, id: string) {
    const parent = this.session(request, id);
    const token = randomBytes(32).toString("base64url");
    await this.store.updateAuth((auth) => {
      this.prune(auth);
      auth.grants.push({ hash: digest(token), kind: "voice", sessionId: id, expiresAt: Date.now() + HOURS, ...(parent.grantHash ? { parentHash: parent.grantHash } : {}), ...(parent.accountId ? { accountId: parent.accountId } : {}), ...(parent.patientId ? { patientId: parent.patientId } : {}) });
    });
    return token;
  }
  requireVoice(id: string, token: unknown) {
    const grant = typeof token === "string" ? this.activeGrant(token, "voice") : undefined;
    if (!grant || grant.sessionId !== id || (grant.patientId && !this.store.getAuth().memberships?.some((m) => m.patientId === grant.patientId && m.sessionId === id))) throw new HttpError(401, "Voice session access expired or revoked");
  }
  private removeGrant(auth: AuthState, hash: string) { auth.grants = auth.grants.filter((g) => g.hash !== hash && g.parentHash !== hash); }
  private prune(auth: AuthState) {
    auth.grants = auth.grants.filter((g) => g.expiresAt > Date.now());
    auth.invitations = auth.invitations.filter((i) => i.expiresAt > Date.now());
  }
}
