import React, { useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@material-ui/core";
import { message } from "antd"; // superbe bibliothèque..
import logo from '../../assets/hdmlogo.png';
import bcrypt from "bcryptjs"; // Importez bcryptjs

const AuthAdmin = () => {
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState(""); 

  const navigate = useNavigate();

  const handleAdminEmailChange = (e) => {
    setAdminEmail(e.target.value.toLowerCase());
  };
  const handleAdminPasswordChange = (e) => { 
    setAdminPassword(e.target.value);
  };
  
  const loginAsAdmin = () => {
    if (adminEmail === "" || adminPassword === "") { 
      message.warning('Merci de remplir tous les champs svp.');
      return;
    }

    axios.get("http://localhost:4001/users")
      .then((response) => {
        const users = response.data;

        // si dans response je trouve l'email de l'input qui match avec le role admin alors je stock ça dans "user"
        const user = users.find((user) => user.email === adminEmail && user.role.includes("ADMIN"));

        if (user) {  
          // j'utilise bcrypt.js pour comparer le mdp hashé en bdd et l'input password
          const passwordMatch = bcrypt.compareSync(adminPassword, user.password);

          if (passwordMatch) {
            navigate("/adminPanel");
          } else {
            message.error('Mot de passe incorrect.');
          }
        } else {
           message.error('Utilisateur non autorisé.');
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
          <img className='logo' src={logo} alt="" style={{width:"150px", position:'absolute',top: '0',left:'0'}} />
     </Link>
     <br />
      <div className="content">
      <input
        type="email"
        name="email"
        placeholder="Email administrateur"
        onChange={handleAdminEmailChange}
        onKeyDown={handleKeyDown}
      /> <br /><br />
      <input
        type="password"
        name="password"
        placeholder="Mot de passe"
        onChange={handleAdminPasswordChange}
        onKeyDown={handleKeyDown}
      />
      <br /><br />
      <Button className='startBtn' variant="contained" color="primary" onClick={loginAsAdmin}>
        Se connecter
      </Button>
      </div>
    </div>
  );
};

export default AuthAdmin;
