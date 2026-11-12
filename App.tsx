import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Login from './app/page';
import { LayoutApp } from '@/components/LayoutApp';
import Recebidos from './app/recebidos/page';
import Contas from './app/contas/page';
import Configuracao from './app/configuracao/page';

/** Uma rota por tela */
export const App: React.FC = () => (
  <Routes>
    <Route path="/" element={<Login />} />
    <Route element={<LayoutApp />}>
      <Route path="/recebidos" element={<Recebidos />} />
      <Route path="/contas" element={<Contas />} />
      <Route path="/configuracao" element={<Configuracao />} />
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);
