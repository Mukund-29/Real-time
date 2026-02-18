import React from 'react';
import { User } from '../types';
import './PresenceIndicator.css';

interface PresenceIndicatorProps {
  users: User[];
  currentUser: User | null;
}

export const PresenceIndicator: React.FC<PresenceIndicatorProps> = ({ users, currentUser }) => {
  const otherUsers = users.filter(u => !currentUser || u.id !== currentUser.id);

  return (
    <div className="presence-indicator">
      <div className="presence-header">
        <span className="presence-label">Online Users:</span>
        <span className="presence-count">{users.length}</span>
      </div>
      <div className="presence-users">
        {currentUser && (
          <div className="presence-user current" style={{ borderColor: currentUser.color }}>
            <div className="presence-avatar" style={{ backgroundColor: currentUser.color }}>
              {currentUser.name.charAt(0).toUpperCase()}
            </div>
            <span className="presence-name">You</span>
          </div>
        )}
        {otherUsers.map((user) => (
          <div key={user.id} className="presence-user" style={{ borderColor: user.color }}>
            <div className="presence-avatar" style={{ backgroundColor: user.color }}>
              {user.name.charAt(0).toUpperCase()}
            </div>
            <span className="presence-name">{user.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
