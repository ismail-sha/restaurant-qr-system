import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <BrowserRouter>
    <App />
    <Toaster
      position="top-right"
      toastOptions={{
        style: { background: '#1a1a1a', color: '#f0f0f0', border: '1px solid #333', fontSize: 14 },
        duration: 4000,
      }}
    />
  </BrowserRouter>
);
