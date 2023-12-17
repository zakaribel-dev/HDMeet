import React, { Component } from 'react';
import {Button } from '@material-ui/core';
import logo from './assets/hdmlogo.png';
import './style/Home.css';

class Home extends Component {


  handleChange = (e) => {
    this.setState({ url: e.target.value });
  }

  create = () => {

      const randomUrl = Math.random().toString(36).substring(2, 7);
      window.location.href = `/${randomUrl}`;
  
  }

  render() {
    return (
      <div className="container2">
        <div>
          <img className='logo' src={logo} alt="" /> <br/>
          <Button className='startBtn' variant="contained" color="primary" onClick={this.create}>Commencer</Button>

        </div>

      </div>
    );
  }
}

export default Home;
