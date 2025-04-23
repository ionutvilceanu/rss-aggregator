import React from 'react';
import { Card, CardContent, CardMedia, Typography, Box, Button, Link } from '@mui/material';
import { Launch as LaunchIcon } from '@mui/icons-material';

interface ArticleCardProps {
  title: string;
  content: string;
  imageUrl?: string;
  date: string;
  articleUrl: string;
}

const ArticleCard: React.FC<ArticleCardProps> = ({ 
  title, 
  content, 
  imageUrl, 
  date, 
  articleUrl 
}) => {
  return (
    <Card sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, mb: 2 }}>
      {imageUrl && (
        <CardMedia
          component="img"
          sx={{ width: { xs: '100%', md: 200 }, height: { xs: 200, md: 'auto' } }}
          image={imageUrl}
          alt={title}
        />
      )}
      <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
        <CardContent sx={{ flex: '1 0 auto' }}>
          <Typography component="h2" variant="h5" gutterBottom>
            {title}
          </Typography>
          <Typography variant="subtitle1" color="text.secondary" gutterBottom>
            {date}
          </Typography>
          <Typography variant="body1" paragraph>
            {content}
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button 
              component="a" 
              href={articleUrl}
              target="_blank"
              rel="noopener noreferrer"
              endIcon={<LaunchIcon />}
              size="small"
            >
              Citește articolul complet
            </Button>
          </Box>
        </CardContent>
      </Box>
    </Card>
  );
};

export default ArticleCard; 