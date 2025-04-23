import React from 'react';
import Link from 'next/link';
import { List, ListItemButton, ListItemIcon, ListItemText, Box } from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import RssFeedIcon from '@mui/icons-material/RssFeed';
import CreateIcon from '@mui/icons-material/Create';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import WebIcon from '@mui/icons-material/Web';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import SettingsIcon from '@mui/icons-material/Settings';

interface AdminLayoutProps {
  children: React.ReactNode;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  return (
    <Box sx={{ display: 'flex' }}>
      <Box sx={{ width: 240, minHeight: '100vh', borderRight: '1px solid #e0e0e0', padding: '20px 0' }}>
        <List component="nav">
          <Link href="/admin/dashboard" style={{ textDecoration: 'none', color: 'inherit' }}>
            <ListItemButton>
              <ListItemIcon>
                <DashboardIcon />
              </ListItemIcon>
              <ListItemText primary="Dashboard" />
            </ListItemButton>
          </Link>
          
          <Link href="/admin/manage-feeds" style={{ textDecoration: 'none', color: 'inherit' }}>
            <ListItemButton>
              <ListItemIcon>
                <RssFeedIcon />
              </ListItemIcon>
              <ListItemText primary="Gestionează Feed-uri" />
            </ListItemButton>
          </Link>
          
          <Link href="/admin/generate-news" style={{ textDecoration: 'none', color: 'inherit' }}>
            <ListItemButton>
              <ListItemIcon>
                <CreateIcon />
              </ListItemIcon>
              <ListItemText primary="Generează Știri AI" />
            </ListItemButton>
          </Link>
          
          <Link href="/admin/import-rss" style={{ textDecoration: 'none', color: 'inherit' }}>
            <ListItemButton>
              <ListItemIcon>
                <CloudDownloadIcon />
              </ListItemIcon>
              <ListItemText primary="Importă din RSS" />
            </ListItemButton>
          </Link>
          
          <Link href="/admin/scrape-articles" style={{ textDecoration: 'none', color: 'inherit' }}>
            <ListItemButton>
              <ListItemIcon>
                <WebIcon />
              </ListItemIcon>
              <ListItemText primary="Extrage Articole Complete" />
            </ListItemButton>
          </Link>
          
          <Link href="/admin/generate-reels" style={{ textDecoration: 'none', color: 'inherit' }}>
            <ListItemButton>
              <ListItemIcon>
                <VideoLibraryIcon />
              </ListItemIcon>
              <ListItemText primary="Generează Reels" />
            </ListItemButton>
          </Link>
          
          <Link href="/admin/settings" style={{ textDecoration: 'none', color: 'inherit' }}>
            <ListItemButton>
              <ListItemIcon>
                <SettingsIcon />
              </ListItemIcon>
              <ListItemText primary="Setări" />
            </ListItemButton>
          </Link>
        </List>
      </Box>
      <Box sx={{ flexGrow: 1 }}>
        {children}
      </Box>
    </Box>
  );
};

export default AdminLayout; 