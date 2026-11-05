import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import '@fontsource-variable/bricolage-grotesque/standard.css';
import '@fontsource/atkinson-hyperlegible/400.css';
import '@fontsource/atkinson-hyperlegible/700.css';
import './styles.css';
import { PublicLayout } from './components/Layout.jsx';
import { Spinner } from './components/ui.jsx';
import Home from './pages/Home.jsx';
import TutorPage from './pages/TutorPage.jsx';
import OtherSubject from './pages/OtherSubject.jsx';
import RequestStatus from './pages/RequestStatus.jsx';
import WaitlistManage from './pages/WaitlistManage.jsx';
import Privacy from './pages/Privacy.jsx';
import { DeletionRequest, DeletionConfirm } from './pages/Deletion.jsx';
import NotFound from './pages/NotFound.jsx';

// Het beheergedeelte wordt apart geladen, zodat bezoekers het niet mee downloaden
const AdminApp = lazy(() => import('./admin/AdminApp.jsx'));

const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/bijles/:slug', element: <TutorPage /> },
      { path: '/andere', element: <OtherSubject /> },
      { path: '/aanvraag/:token', element: <RequestStatus /> },
      { path: '/wachtlijst/:token', element: <WaitlistManage /> },
      { path: '/privacy', element: <Privacy /> },
      { path: '/privacy/verwijderen', element: <DeletionRequest /> },
      { path: '/privacy/verwijderen/:token', element: <DeletionConfirm /> },
      { path: '*', element: <NotFound /> },
    ],
  },
  { path: '/beheer/*', element: <Suspense fallback={<div className="wrap pad"><Spinner /></div>}><AdminApp /></Suspense> },
]);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><RouterProvider router={router} /></React.StrictMode>,
);
