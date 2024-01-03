import React, { useEffect, useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@material-ui/core";
import { message } from "antd"; // superbe bibliothèque

 // J4AI DU FAIRE UN COMPONENT FONCTIONNEL PSK GALERE POUR LA REDIRECTION EN CLASSE  )-:  )-:  )-: 
const Admin = () => {
  const [adminEmail, setAdminEmail] = useState("");
  const navigate = useNavigate();

  const handleAdminEmailChange = (e) => {
    setAdminEmail(e.target.value);
  };

  const loginAsAdmin = () => {
    if (adminEmail === "") {
      message.warning('Merci de remplir ce foutu champ svp.. ');
      return;
    }

    axios.get("http://localhost:4001/users")
      .then((response) => {
        const isAdmin = response.data.some(
          (user) => user.email === adminEmail && user.role.includes("ADMIN")
        );

        if (isAdmin) {
          navigate("/adminPanel");
        } else {
          alert("pas autorisé, zou!");
        }
      })
      .catch((error) => {
        console.error("Erreur lors de la récupération des utilisateurs :", error);
      });
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      loginAsAdmin();
    }
  };

  return (
    <div>
      <Link to="/">
        <Button variant="contained" color="secondary">
          Retour à l'accueil
        </Button>
      </Link>
      <br /><br />
      <h1><i>Connexion administrateur</i></h1>
      <input
        type="email"
        placeholder="Email administrateur"
        onChange={handleAdminEmailChange}
        onKeyDown={handleKeyDown}
      /><br /><br />
      <Button variant="contained" color="primary" onClick={loginAsAdmin}>
        Se connecter
      </Button>
    </div>
  );
};

export default Admin;
