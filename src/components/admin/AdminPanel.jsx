// AdminPanel.jsx
import React, { Component } from 'react';
import { Input, Button } from "@material-ui/core";
import { Link } from "react-router-dom";
import { message } from "antd"; // superbe bibliothèque

import axios from 'axios';

class AdminPanel extends Component {
  constructor(props) {
    super(props);
    this.state = {
      userEmail: '',
      role: 'ADMIN',
    };
  }
componentDidMount(){
    message.info('coucou toi..')
}

  handleEmailChange = (e) => {
    this.setState({ userEmail: e.target.value });
  }

  handleRoleChange = (e) => {
    this.setState({ role: e.target.value });
  }

  handleSubmit = (e) => {
    e.preventDefault();
    const { userEmail, role } = this.state;

    axios.put(`http://localhost:4001/updateRoles`, { email: userEmail, newRole: role })
    .then((response) => {
        message.success(JSON.stringify(response.data.message))
    })
      .catch((error) => {
        message.error(error.response.data.error)
    });
  }

  render() {
    return (
      <div>
    <Link to="/">
        <Button variant="contained" color="secondary">
          Retour à l'accueil
        </Button>
      </Link>     
      <br /><br />
         <h1><i>Admin Panel</i></h1>
        <form onSubmit={this.handleSubmit}>
          <div>
            <label><b>Email de l'utilisateur : </b></label> 
            
            <Input
              type="email"
              value={this.state.userEmail}
              onChange={this.handleEmailChange}
              required
            style={{backgroundColor:'white', borderRadius:'8px', margin:'10px'}}/>
          </div>
          <div>
            <label> <b>Choisissez le rôle :</b></label>
            <select
              value={this.state.role}
              onChange={this.handleRoleChange}
              style={{borderRadius:'8px', margin:'10px'}}
            >
              <option value="ADMIN">ADMIN</option>
              <option value="USER">USER</option>
            </select>
          </div>
          <br />
          <Button variant="contained" color="primary" type="submit">Modifier le rôle</Button>
        </form>
      </div>
    );
  }
}

export default AdminPanel;
