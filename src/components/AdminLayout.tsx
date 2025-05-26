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
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import MovieIcon from '@mui/icons-material/Movie';
import ChatIcon from '@mui/icons-material/Chat';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import { MenuItem } from '@mui/material';

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
          
          <Link href="/admin/generate-viral-articles" style={{ textDecoration: 'none', color: 'inherit' }}>
            <ListItemButton>
              <ListItemIcon>
                <TrendingUpIcon />
              </ListItemIcon>
              <ListItemText primary="Articole Virale" />
            </ListItemButton>
          </Link>
          
          <Link href="/admin/generate-by-prompt" style={{ textDecoration: 'none', color: 'inherit' }}>
            <ListItemButton>
              <ListItemIcon>
                <ChatIcon />
              </ListItemIcon>
              <ListItemText primary="Generează din Prompt" />
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
          
          <Link href="/admin/rewrite-articles" style={{ textDecoration: 'none', color: 'inherit' }}>
            <ListItemButton>
              <ListItemIcon>
                <ContentPasteIcon />
              </ListItemIcon>
              <ListItemText primary="Rescriere articole" />
            </ListItemButton>
          </Link>
          
          <Link href="/admin/generate-reels" style={{ textDecoration: 'none', color: 'inherit' }}>
            <ListItemButton>
              <ListItemIcon>
                <MovieIcon />
              </ListItemIcon>
              <ListItemText primary="Generare TikTok" />
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