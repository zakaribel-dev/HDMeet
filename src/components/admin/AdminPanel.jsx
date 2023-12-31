// Import des dépendances
import React, { Component } from "react"
import { Button } from "@material-ui/core"
import { Link } from "react-router-dom"
import { message } from "antd"
import logo from "../../assets/hdmlogo.png"
import Rodal from "rodal"
import "rodal/lib/rodal.css"
import axios from "axios"
import "../../style/Admin.css"

class AdminPanel extends Component {

  
  constructor(props) {
    super(props)
    this.state = {
      // État initial
      userEmail: "",
      role: "ADMIN",
      showCreateUserForm: false,
      showRoleUpdateForm: false,
      newUserEmail: "",
      newUserRole: "USER",
      users: [],
      showUserTable: false,
      selectedUserForRoleUpdate: null,
      showPasswordInputForUpdate: false,
      showPasswordInputForCreate: false,
      password: "",
      newPassword: "",
    }

  
  }
  componentDidMount() {
    this.fetchUsers();
    const adminEmail = localStorage.getItem('adminEmail');
    this.setState({ userEmail: adminEmail });
  }


  fetchUsers = () => {
    // Fonction pour récupérer les utilisateurs depuis le serveur
    axios
      .get(`http://localhost:4001/users`)
      .then((response) => {
        this.setState({ users: response.data })
      })
      .catch((error) => {
        message.error("Erreur lors de la récupération des utilisateurs")
      })
  }

  openRoleUpdateModal = (user) => {
    // Fonction pour ouvrir la fenêtre de mise à jour du rôle
    this.setState({
      selectedUserForRoleUpdate: user,
      role: user.role,
    })
  }

  closeRoleUpdateModal = () => {
    // Fonction pour fermer la fenêtre de mise à jour du rôle
    this.setState({
      selectedUserForRoleUpdate: null,
      showPasswordInputForUpdate: false,
    })
  }

  toggleRoleUpdateForm = () => {
    this.setState((prevState) => ({
      showRoleUpdateForm: !prevState.showRoleUpdateForm,
      showPasswordInputForUpdate: prevState.role === "ADMIN",
    }))
  }

  toggleCreateUserForm = () => {
    this.setState((prevState) => ({
      showCreateUserForm: !prevState.showCreateUserForm,
      showPasswordInputForCreate: prevState.newUserRole === "ADMIN",
    }))
  }

  toggleUserTable = () => {
    // Fonction pour basculer l'affichage du tableau des utilisateurs
    this.setState((prevState) => ({
      showUserTable: !prevState.showUserTable,
    }))
  }

  handleNewUserEmailChange = (e) => {
    // Fonction pour gérer le changement de l'email du nouvel utilisateur
    this.setState({ newUserEmail: e.target.value })
  }

  handleNewUserRoleChange = (e) => {
    // Fonction pour gérer le changement du rôle du nouvel utilisateur
    const newUserRole = e.target.value
    const showPasswordInputForCreate = newUserRole === "ADMIN"
    this.setState({ newUserRole, showPasswordInputForCreate })
  }

  handleEmailChange = (e) => {
    // Fonction pour gérer le changement de l'email de l'utilisateur
    this.setState({ userEmail: e.target.value })
  }

  handleRoleChange = (e) => {
    const newRole = e.target.value
    const showPasswordInputForUpdate = newRole === "ADMIN"
    this.setState({ role: newRole, showPasswordInputForUpdate })
  
    console.log("Nouveau rôle sélectionné :", newRole)
  }

  handleCreateUser = (e) => {
    // Fonction pour gérer la création d'un nouvel utilisateur
    e.preventDefault()
    const { newUserEmail, newUserRole, password } = this.state

    axios
      .post(`http://localhost:4001/insertUser`, {
        email: newUserEmail,
        role: newUserRole,
        password: newUserRole === "ADMIN" ? password : "",
      })
      .then((response) => {
        message.success("Nouvel accès créé pour " + newUserEmail + " !")
        this.setState({ newUserEmail: "", password: "" })
        this.fetchUsers()
      })
      .catch((error) => {
        message.error(error.response.data.error)
      })
  }

  handleUpdateRole = (e) => {
    // Fonction pour gérer la mise à jour du rôle de l'utilisateur en cours de mise à jour
    e.preventDefault()
    const { role, newPassword } = this.state
    const userEmail = this.state.selectedUserForRoleUpdate.email

    axios
      .put(`http://localhost:4001/updateRoles`, {
        email: userEmail,
        newRole: role,
        newPassword: role === "ADMIN" ? newPassword : "",
      })
      .then((response) => {
        message.success("Rôle mis à jour !")
        console.log("new pass " +newPassword)
        this.fetchUsers()
      })
      .catch((error) => {
        message.error(error.response.data.error)
      })
  }

  handleDeleteUser = (email) => {
    // Fonction pour supprimer un utilisateur
    axios
      .delete(`http://localhost:4001/deleteUser/${email}`)
      .then(() => {
        message.success("Utilisateur supprimé avec succès")
        this.fetchUsers()
      })
      .catch((error) => {
        message.error("Erreur lors de la suppression de l'utilisateur")
      })
  }

  formatDate = (dateStr) => {
    // Fonction pour formater une date en format français
    const options = {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }
    return new Date(dateStr).toLocaleDateString("fr-FR", options)
  }

  render() {
    const {
      showCreateUserForm,
      newUserEmail,
      newUserRole,
      users,
      showUserTable,
      selectedUserForRoleUpdate,
      showPasswordInputForUpdate,
      showPasswordInputForCreate,
      password,
    } = this.state

    return (
      <div>
        <Link to="/">
          <img
            className="logo"
            src={logo}
            alt=""
            style={{
              width: "150px",
              position: "absolute",
              top: "0",
              left: "0",
            }}
          />
        </Link>
        <div className="content">
          <h1 style={{ fontFamily: "Nunito / Nunito Sans" }}>Administrateur(trice) : <u>{this.state.userEmail}</u> </h1>
          <br />
          <Button onClick={this.toggleCreateUserForm} variant="contained">
            {showCreateUserForm
              ? "Cacher le formulaire"
              : "Créer un nouvel accès"}
          </Button>
          <br />
          {showCreateUserForm && (
            <form onSubmit={this.handleCreateUser}>
              <div>
                <label>
                  <b>Email du nouvel utilisateur: </b>
                </label>
                <input
                  type="email"
                  value={newUserEmail}
                  onChange={this.handleNewUserEmailChange}
                  required
                  style={{
                    backgroundColor: "white",
                    borderRadius: "8px",
                    margin: "10px",
                  }}
                />
              </div>
              <div>
                <label>
                  <b>Rôle du nouvel utilisateur:</b>
                </label>
                <select
                  value={newUserRole}
                  onChange={this.handleNewUserRoleChange}
                  style={{ borderRadius: "8px", margin: "10px" }}
                >
                  <option value="ADMIN">ADMIN</option>
                  <option value="USER">USER</option>
                </select>
              </div>
              {showPasswordInputForCreate && (
                <div>
                  <label>
                    <b>Mot de passe:</b>
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) =>
                      this.setState({ password: e.target.value })
                    }
                    required
                    style={{
                      backgroundColor: "white",
                      borderRadius: "8px",
                      margin: "10px",
                    }}
                  />
                </div>
              )}
              <button
                className="green-button"
                type="submit"
                variant="contained"
                color="primary"
              >
                Créer l'utilisateur
              </button>
            </form>
          )}
        </div>

        <br />
        <Button onClick={this.toggleUserTable} variant="contained">
          {showUserTable
            ? "Cacher le tableau"
            : "Afficher le tableau des accès"}
        </Button>

        {showUserTable && (
          <table className="user-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Rôle</th>
                <th>Date de création</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.email}>
                  <td>
                    <b>{user.email}</b>
                  </td>
                  <td>
                    <b>{user.role}</b>
                  </td>
                  <td>
                    <b>{this.formatDate(user.created_At)}</b>
                  </td>
                  <td>
                    <button
                      className="red-button"
                      onClick={() => this.handleDeleteUser(user.email)}
                    >
                      Supprimer
                    </button>
                    <button
                      className="blue-button"
                      onClick={() => this.openRoleUpdateModal(user)}
                    >
                      Modifier le rôle
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <Rodal
          visible={selectedUserForRoleUpdate !== null}
          onClose={this.closeRoleUpdateModal}
          animation="zoom"
          customStyles={{
            width: "300px",
          }}
        >
          <h2>Modifier le rôle de l'utilisateur</h2>
          {selectedUserForRoleUpdate && (
            <div>
              <br />
              <i>
                {" "}
                <b>{selectedUserForRoleUpdate.email}</b>
              </i>{" "}
              <br />
              <input type="hidden" value={selectedUserForRoleUpdate.email} />
              <br />
              <label>
                {" "}
                <b>Nouveau rôle : &nbsp;</b>
              </label>
              <select value={this.state.role} onChange={this.handleRoleChange}>
                <option value="ADMIN">ADMIN</option>
                <option value="USER">USER</option>
              </select>
              {showPasswordInputForUpdate && (
                <div>
                  <label>
                    <b>Mot de passe:</b>
                  </label>
                  <input
                    type="password"
                    value={this.state.newPassword}
                    onChange={(e) =>
                      this.setState({ newPassword: e.target.value })
                    }
                    required
                    style={{
                      backgroundColor: "white",
                      borderRadius: "8px",
                      margin: "10px",
                    }}
                  />
                </div>
              )}
              <br /> <br />
              <button
                onClick={this.handleUpdateRole}
                variant="contained"
                className="green-button"
                type="submit"
              >
                Modifier le rôle
              </button>
              <br />
              <button
                className="red-button"
                onClick={this.closeRoleUpdateModal}
              >
                Fermer
              </button>
            </div>
          )}
        </Rodal>
      </div>
    )
  }
}

export default AdminPanel
