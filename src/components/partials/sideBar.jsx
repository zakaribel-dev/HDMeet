import React, { Component } from 'react';
import { Button } from '@material-ui/core';

class Sidebar extends Component {



    render() {
        const { usernames, isSidebarOpen, toggleSidebar } = this.props;
        const sidebarClass = isSidebarOpen ? "sidebar open" : "sidebar";

        return (
            <div className={sidebarClass}>
                <Button className="toggle-button" onClick={toggleSidebar}>
                    {isSidebarOpen ? "Cacher" : "Afficher"}
                </Button>
                <h3>Utilisateurs Connectés</h3>
                <ul>
                    {Object.values(usernames).map((username, index) => (
                        <li key={index}>
                            <span className="online-indicator"></span>
                            {username}
                        </li>
                    ))}
                </ul>
            </div>
        );
    }
}

export default Sidebar;
