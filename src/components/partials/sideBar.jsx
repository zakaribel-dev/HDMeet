import React, { Component } from 'react';
import { Button } from '@material-ui/core';
import KickSVG from '../../assets/boot-out-fire-kick-out-firing-an-employee-svgrepo-com.svg';


class Sidebar extends Component {
  render() {
    const { usernames, isSidebarOpen, toggleSidebar, kickUser, isAdmin, socketId } = this.props;
    const sidebarClass = isSidebarOpen ? "sidebar open" : "sidebar";

    return (
      <div className={sidebarClass}>
        <Button className="toggle-button" onClick={toggleSidebar} variant="contained">
          {isSidebarOpen ? "Cacher" : "Afficher"}
        </Button>
        <div className='smallContainer'>
          <h3>Utilisateurs :</h3>
          <ul>
            {Object.entries(usernames).map(([userId, username], index) => (
              <li key={index}>
                <span className="online-indicator"></span>
                {username}
                {isAdmin && userId !== socketId && (
                  <Button onClick={() => kickUser(userId)}  color="secondary">
                    <img src={KickSVG} alt="Kick" style={{ width: '24px', height: '50px' }} />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }
}

export default Sidebar;
