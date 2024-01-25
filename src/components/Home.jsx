import { React, useEffect, useState } from 'react';
import { Button } from '@material-ui/core';
import logo from '../assets/hdmlogo.png';
import '../style/Home.css';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/authContext';

const Home = () => {
  const { isAuthenticated, isTokenExpired } = useAuth();
  
  const createRoom = () => {
    const newRoom = Math.random().toString(36).substring(3, 25);
    window.location.href = `/${newRoom}`;
  }

  return (
    <div className="container2">
      <div>
        <img className='logo' src={logo} alt="" /> <br />
        <Button className='startBtn' variant="contained" color="primary" onClick={createRoom}>Commencer</Button>

        {
          <Link to={isTokenExpired ? "/authAdmin?sessionExpired=true" : (isAuthenticated ? "/adminPanel" : "/authAdmin")}>
            <Button className='startBtn' variant="contained" color="primary">Administration</Button>
          </Link>
        }
      </div>
    </div>
  );
}

export default Home;
