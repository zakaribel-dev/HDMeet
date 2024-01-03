import React, { Component } from 'react';
import { Button } from '@material-ui/core';
import logo from '../assets/hdmlogo.png';
import '../style/Home.css';
import { Link } from 'react-router-dom';

class Home extends Component {

  handleChange = (e) => {
    this.setState({ url: e.target.value });
  }

  createRoom = () => {
    const newRoom = Math.random().toString(36).substring(5, 9);
    window.location.href = `/${newRoom}`;
  }

  render() {
    return (
      <div className="container2">
        <div>
          <img className='logo' src={logo} alt="" /> <br />
          <Button className='startBtn' variant="contained" color="primary" onClick={this.createRoom}>Commencer</Button>
            <Link to="/AuthAdmin"> 
            <Button variant="contained" color="primary">Administration</Button>
          </Link>
        </div>
      </div>
    );
  }
}

export default Home;
