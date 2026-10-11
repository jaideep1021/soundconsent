import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { demoDocuments, type ConsentDocument } from "@/data/demo-documents";
interface DocumentState {
  documents: ConsentDocument[];
  save: (document: ConsentDocument) => void;
  duplicate: (id: string) => void;
}
export const useDocumentStore = create<DocumentState>()(
  persist(
    (set, get) => ({
      documents: demoDocuments,
      save: (document) =>
        set((state) => ({
          documents: state.documents.some((d) => d.id === document.id)
            ? state.documents.map((d) => (d.id === document.id ? document : d))
            : [...state.documents, document],
        })),
      duplicate: (id) => {
        const document = get().documents.find((d) => d.id === id);
        if (document)
          get().save({
            ...document,
            id: crypto.randomUUID(),
            title: `${document.title} (copy)`,
            status: "Draft",
          });
      },
    }),
    {
      name: "demo-documents-v1",
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
