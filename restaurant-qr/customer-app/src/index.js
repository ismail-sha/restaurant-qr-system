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
      position="top-center"
      toastOptions={{
        duration: 3000,
        style: { fontSize: '14px', fontWeight: 500 },
      }}
    />
  </BrowserRouter>
);
