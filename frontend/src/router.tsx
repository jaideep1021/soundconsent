import { createBrowserRouter } from 'react-router';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { PatientLayout } from '@/components/layout/patient-layout';

import LandingPage from '@/pages/landing';
import LoginPage from '@/pages/login';
import DashboardHome from '@/pages/dashboard/index';
import DocumentsPage from '@/pages/dashboard/documents/index';
import DocumentDetail from '@/pages/dashboard/documents/[id]';
import SessionsPage from '@/pages/dashboard/sessions/index';
import NewSessionPage from '@/pages/dashboard/sessions/new';
import SessionDetail from '@/pages/dashboard/sessions/[id]/index';
import UnderstandingReportPage from '@/pages/dashboard/sessions/[id]/report';
import SettingsPage from '@/pages/dashboard/settings';

import IdentityVerificationPage from '@/pages/session/index';
import SessionOverviewPage from '@/pages/session/overview';
import SessionChatPage from '@/pages/session/chat';
import SessionVoicePage from '@/pages/session/voice';
import SessionSummaryPage from '@/pages/session/summary';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <LandingPage />,
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/dashboard',
    element: <DashboardLayout />,
    children: [
      {
        index: true,
        element: <DashboardHome />,
      },
      {
        path: 'documents',
        element: <DocumentsPage />,
      },
      {
        path: 'documents/:id',
        element: <DocumentDetail />,
      },
      {
        path: 'sessions',
        element: <SessionsPage />,
      },
      {
        path: 'sessions/new',
        element: <NewSessionPage />,
      },
      {
        path: 'sessions/:id',
        element: <SessionDetail />,
      },
      {
        path: 'sessions/:id/report',
        element: <UnderstandingReportPage />,
      },
      {
        path: 'settings',
        element: <SettingsPage />,
      },
    ],
  },
  {
    path: '/session/:sessionId',
    element: <PatientLayout />,
    children: [
      {
        index: true,
        element: <IdentityVerificationPage />,
      },
      {
        path: 'overview',
        element: <SessionOverviewPage />,
      },
      {
        path: 'chat',
        element: <SessionChatPage />,
      },
      {
        path: 'voice',
        element: <SessionVoicePage />,
      },
      {
        path: 'summary',
        element: <SessionSummaryPage />,
      },
    ],
  },
]);

