import React, { Component } from 'react';
import { Input, Button } from '@material-ui/core';
import logo from './assets/hdmlogo.png';
import './style/Home.css';

class Home extends Component {
  constructor(props) {
    super(props);
    this.state = {
      url: '',
    };
  }

  handleChange = (e) => {
    this.setState({ url: e.target.value });
  }

  join = () => {
    const { url } = this.state;
    if (url !== "") {
      const urlParts = url.split("/");
      window.location.href = `/${urlParts[urlParts.length - 1]}`;
    } else {
      const randomUrl = Math.random().toString(36).substring(2, 7);
      window.location.href = `/${randomUrl}`;
    }
  }

  render() {
    return (
      <div className="container2">
        <div>
          <img className='logo' src={logo} alt="" />
          <p style={{ fontWeight: "500" }}>Coucou</p>
        </div>

        <div style={{
          background: "white", width: "30%", height: "auto", padding: "20px", minWidth: "400px",
          textAlign: "center", margin: "auto", marginTop: "100px"
        }}>
          <p style={{ margin: 0, fontWeight: "bold", paddingRight: "50px" }}>
            Si vous créez une conférence, cliquez simplement sur "Commencer", sinon collez le lien de la conférence et cliquez sur "Commencer"
          </p>
          <Input placeholder="lien vers conférence" onChange={this.handleChange} />
          <Button variant="contained" color="primary" onClick={this.join} style={{ margin: "20px", backgroundColor:'#8EC8F2' }}>Commencer</Button>
        </div>
      </div>
    );
  }
}

export default Home;
