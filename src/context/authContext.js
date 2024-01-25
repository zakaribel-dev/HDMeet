import React, { createContext, useContext, useState,useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';

// CONTEXT = permet de wrapper des composants enfants pour pouvoir leurs transmettre des states ou methodes du coup,
// plus besoin de transmettre tout ça via props à chaque niveau 
const AuthContext = createContext();

// du coup mon authProvider va être utilisé en tant que wrapper pour gérer l'état d'authentification des composant enfants
export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem('authToken') || null); // en fonction de là où on se situe dans l'appli et du moment, il peut y avoir un token ou non .
  // Faut savoir que authContext est utilisé comme wrapper (via le component protectedRoute) donc à tout moment l'appli est soumise au context
  const [isTokenExpired, setIsTokenExpired] = useState(false);


  useEffect(() => { // gestion expiration token
    const checkTokenExpiration = () => {
      if (token) {
        try {
          const decodedToken = jwtDecode(token);
          const currentTime = Math.floor(Date.now() / 1000);
          setIsTokenExpired(decodedToken.exp < currentTime);
        } catch (error) {
          console.error("Error decoding JWT:", error);
          setIsTokenExpired(true); 
        }
      }
    };
  
    checkTokenExpiration();
  }, [token, setIsTokenExpired]);
  

  const login = (newToken) => { // cette methode va prendre le token que j'ai récup dans le call api d'adminPanel pi va le foutre dans localstorage
    setToken(newToken);
    localStorage.setItem('authToken', newToken);
  };

  // je gere le logout directement dans adminPanel..

  // grâce à ce que je return jvais pouvoir recuperer token, isAuthenticated et login en faisant un useAuth dans mes autres components
  // je convertis token en booleen pour set isAuthenticated comme il se doit
  return (    
    <AuthContext.Provider value={{ token, isAuthenticated: Boolean(token), isTokenExpired, login }}>   
      {children}
    </AuthContext.Provider>
  );
};

// j'creer un hook perso "useAuth" qui permet de faire en sorte que les composants enfants pourront utiliser useAuth pour avoir accès à ce que je return dans mon authProvider (token, isAuthenticated et login)
export const useAuth = () => {
  return useContext(AuthContext);
};
