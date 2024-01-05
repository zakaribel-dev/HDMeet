import React, { useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@material-ui/core";
import { message } from "antd"; // superbe bibliothèque..
import logo from '../../assets/hdmlogo.png';

 // J4AI DU FAIRE UN COMPONENT FONCTIONNEL PSK GALERE POUR LA REDIRECTION EN CLASSE  )-:  )-:  )-: 
const AuthAdmin = () => {
  const [adminEmail, setAdminEmail] = useState("");
  const navigate = useNavigate();

  const handleAdminEmailChange = (e) => {
    setAdminEmail(e.target.value.toLowerCase()); // jpréviens la casse 
  };

  const isValidEmail = (email) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  };

  const loginAsAdmin = () => {
    if (!isValidEmail(adminEmail)) {
      message.warning('Adresse e-mail invalide. Veuillez entrer une adresse e-mail valide.');
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
           message.error('Pas autorisé, allez zou!')
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
        placeholder="Email administrateur"
        onChange={handleAdminEmailChange}
        onKeyDown={handleKeyDown}
      /><br /><br />
      <Button className='startBtn' variant="contained" color="primary" onClick={loginAsAdmin}>
        Se connecter
      </Button>
      </div>
    </div>
  );
};

export default AuthAdmin;
