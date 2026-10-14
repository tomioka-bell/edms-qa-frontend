import { createBrowserRouter, Navigate } from 'react-router-dom';
import AppLayout from '../layouts/AppLayout';
import RequireAuth from '../components/auth/RequireAuth';
import LoginRedirect from '../components/auth/LoginRedirect';
import { USE_GATEWAY_AUTH } from '../lib/auth';
import DashboardPage from '../pages/Dashboard/DashboardPage';
import DocumentControlPage from '../pages/DocumentControl/DocumentControlPage';
import ApprovalTemplatesPage from '../pages/ApprovalTemplates/ApprovalTemplatesPage';
import DocumentTemplatesPage from '../pages/DocumentTemplates/DocumentTemplatesPage';
import MySignaturePage from '../pages/MySignature/MySignaturePage';
import PlaceholderPage from '../pages/Placeholder/PlaceholderPage';
import NotFoundPage from '../pages/NotFound/NotFoundPage';
import CreateDocumentPage from '../pages/CreateDocument/CreateDocumentPage';
import RequestEditorPage from '../pages/CreateDocument/RequestEditorPage';
import MyDocumentsPage from '../pages/MyDocuments/MyDocumentsPage';
import MyTasksPage from '../pages/MyTasks/MyTasksPage';
import ReviewDocumentPage from '../pages/ReviewDocument/ReviewDocumentPage';
import ReturnedDocumentsPage from '../pages/ReturnedDocuments/ReturnedDocumentsPage';
import SuppliersPage from '../pages/Suppliers/SuppliersPage';
import AccessPage from '../pages/Access/AccessPage';
import ExpiringDocumentsPage from '../pages/ExpiringDocuments/ExpiringDocumentsPage';
import RequireAdmin from '../components/auth/RequireAdmin';

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/dashboard" replace /> },
  // QA has no sign-in page of its own: old /qa/login links go to the central one
  { path: '/login', element: <LoginRedirect /> },
  {
    element: USE_GATEWAY_AUTH ? (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ) : (
      <AppLayout />
    ),
    children: [
      { path: '/dashboard', element: <DashboardPage /> },
      { path: '/documents', element: <DocumentControlPage /> },
      { path: '/tasks', element: <MyTasksPage /> },
      { path: '/tasks/:id', element: <ReviewDocumentPage /> },
      { path: '/my-documents', element: <MyDocumentsPage /> },
      { path: '/documents/new', element: <CreateDocumentPage /> },
      { path: '/documents/edit/:id', element: <RequestEditorPage /> },
      { path: '/documents/returned', element: <ReturnedDocumentsPage /> },
      { path: '/documents/released', element: <PlaceholderPage title="Released Documents" eyebrow="DOCUMENTS" /> },
      { path: '/documents/expiring', element: <ExpiringDocumentsPage /> },
      { path: '/documents/obsolete', element: <PlaceholderPage title="Obsolete Documents" eyebrow="DOCUMENTS" /> },
      { path: '/control/approval', element: <PlaceholderPage title="Documents for Approval" eyebrow="CONTROL" /> },
      { path: '/control/review', element: <PlaceholderPage title="Documents for Review" eyebrow="CONTROL" /> },
      { path: '/control/acknowledgement', element: <PlaceholderPage title="Document Acknowledgement" eyebrow="CONTROL" /> },
      { path: '/search', element: <PlaceholderPage title="Search" eyebrow="CONTROL" /> },
      { path: '/reports', element: <PlaceholderPage title="Reports" eyebrow="CONTROL" /> },
      { path: '/audit-trail', element: <PlaceholderPage title="Audit Trail" eyebrow="CONTROL" /> },
      { path: '/edi', element: <PlaceholderPage title="EDI" eyebrow="INTEGRATIONS" /> },
      // Administrators only (the server refuses changes from anyone else as well)
      { path: '/document-templates', element: <RequireAdmin><DocumentTemplatesPage /></RequireAdmin> },
      { path: '/my-signature', element: <MySignaturePage /> },
      { path: '/approval-templates', element: <RequireAdmin><ApprovalTemplatesPage /></RequireAdmin> },
      { path: '/suppliers', element: <RequireAdmin><SuppliersPage /></RequireAdmin> },
      { path: '/access', element: <RequireAdmin><AccessPage /></RequireAdmin> },
      { path: '/master-data', element: <PlaceholderPage title="Master Data" eyebrow="ADMINISTRATION" /> },
      { path: '/settings', element: <PlaceholderPage title="Settings" eyebrow="ADMINISTRATION" /> },
      // Anything else: a 404 inside the app shell, so the menu is still there to find the way back
      { path: '*', element: <NotFoundPage /> },
    ],
  },
], { basename: '/qa' });
