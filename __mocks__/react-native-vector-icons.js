import React from 'react';
const createIconComponent = () => {
  const Icon = ({ name, size = 24, color = 'black', ...rest }) => {
    // Render a simple placeholder to avoid native linking in tests
    return React.createElement('Icon', { 'data-name': name, size, color, ...rest });
  };
  return Icon;
};
export default createIconComponent();
