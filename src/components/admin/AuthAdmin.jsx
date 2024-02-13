import React, { useState, useEffect } from "react"
import axios from "axios"
import { Link, useNavigate } from "react-router-dom"
import { Button } from "@material-ui/core"
import { message } from "antd" // superbe bibliothèque..
import logo from "../../assets/hdmlogo.png"
import { useAuth } from "../../context/authContext"

const AuthAdmin = () => {
  const [adminEmail, setAdminEmail] = useState("")
  const [adminPassword, setAdminPassword] = useState("")
  const { login } = useAuth() // fonction login de authContext
  const navigate = useNavigate()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionExpired = params.get('sessionExpired');

    if (sessionExpired === 'true') {
      message.warning('Votre session a expiré. Veuillez vous reconnecter.');
    }
  }, []);
  
  
  const handleAdminEmailChange = (e) => {
    setAdminEmail(e.target.value.toLowerCase())
  }
  const handleAdminPasswordChange = (e) => {
    setAdminPassword(e.target.value)
  }

  const loginAsAdmin = () => {
    if (adminEmail === "" || adminPassword === "") {
      message.warning("Merci de remplir tous les champs svp ! ")
      return
    }

    axios
      .post("http://localhost:4001/login", {
        email: adminEmail,
        password: adminPassword,
      })
      .then((response) => {
    
          const { token } = response.data

          login(token) // j'envoie le token en localstorage via la methode login de authContext !
  
          localStorage.setItem("adminEmail", adminEmail)
          navigate("/adminPanel")
  
      })
      .catch((error) => {
        if(error.response.status === 403){
          message.error("Vous n'êtes pas admin, zou !")
        }
        if(error.response.status === 401){
          message.error("Mot de passe incorrect !")
        }
        console.error("erreur! " + error)
      })
  }

  
  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      loginAsAdmin()
    }
  }

  return (
    <div>
      <Link to="/">
        <img
          className="logo"
          src={logo}
          alt=""
          style={{ width: "150px", position: "absolute", top: "0", left: "0" }}
        />
      </Link>
      <br />
      <div className="content">
        <input
          type="email"
          name="email"
          placeholder="Email administrateur"
          onChange={handleAdminEmailChange}
          onKeyDown={handleKeyDown}
        />{" "}
        <br />
        <br />
        <input
          type="password"
          name="password"
          placeholder="Mot de passe"
          onChange={handleAdminPasswordChange}
          onKeyDown={handleKeyDown}
        />
        <br />
        <br />
        <Button
          className="startBtn"
          variant="contained"
          color="primary"
          onClick={loginAsAdmin}
        >
          Se connecter
        </Button>
      </div>
    </div>
  )
}

export default AuthAdmin