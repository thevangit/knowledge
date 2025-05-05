import { GithubOutlined } from '@ant-design/icons';
import { DefaultFooter } from '@ant-design/pro-components';
import React from 'react';

const Footer: React.FC = () => {
  return (
    <DefaultFooter
      style={{
        background: 'none',
      }}
      links={[
        {
          key: 'Wins Knowledge',
          title: 'Wins Knowledge',
          href: '/',
          blankTarget: true,
        }
      ]}
    />
  );
};

export default Footer;
