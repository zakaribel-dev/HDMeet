import React from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';
import { useAuth } from '../context/authContext';

const ProtectedRoute = ({ component: Component }) => {
  const { token } = useAuth(); // mon authcontext me retourne un token

  return token ? ( // si ya un token in ze building alors je dirige vers la route qu'il faut (adminPanel en loccurence)
    <Routes>
      <Route path="/*" element={<Component />} />
    </Routes>
  ) : (
    <Navigate to="/authAdmin" /> // sinon (pas connecté) faut se login
  );
};

export default ProtectedRoute;
