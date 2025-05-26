import { useState, useRef } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { Box, TextField, Button, Checkbox, FormControlLabel, Typography, Paper, List, ListItem, ListItemText, Divider, CircularProgress, Alert, Chip, IconButton, Grid, Tooltip } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import DeleteIcon from '@mui/icons-material/Delete';
import SendIcon from '@mui/icons-material/Send';
import NewspaperIcon from '@mui/icons-material/Newspaper';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';

export default function GenerateViralArticles() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [customTopics, setCustomTopics] = useState<string[]>([]);
  const [newTopic, setNewTopic] = useState('');
  const [topicCount, setTopicCount] = useState(5);
  const [forceRefresh, setForceRefresh] = useState(false);
  
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  const handleAddTopic = () => {
    if (newTopic.trim() && !customTopics.includes(newTopic.trim())) {
      setCustomTopics([...customTopics, newTopic.trim()]);
      setNewTopic('');
    }
  };

  const handleRemoveTopic = (index: number) => {
    const updatedTopics = [...customTopics];
    updatedTopics.splice(index, 1);
    setCustomTopics(updatedTopics);
  };

  const handleGenerateArticles = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      setError('');
      setResult(null);
      
      const topicsToUse = customTopics.length > 0 ? customTopics : undefined;
      
      const response = await fetch('/api/generateViralArticles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          count: topicCount,
          forceRefresh,
          topics: topicsToUse
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Eroare la generarea articolelor virale');
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message || 'A apărut o eroare la generarea articolelor virale');
      console.error('Eroare:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTopic();
    }
  };

  return (
    <AdminLayout>
      <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
        <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
          <TrendingUpIcon sx={{ mr: 1 }} /> Generează Articole din Subiecte Virale
        </Typography>
        
        <Paper elevation={3} sx={{ p: 3, mb: 4 }}>
          <form ref={formRef} onSubmit={handleGenerateArticles}>
            <Typography variant="h6" gutterBottom>
              Configurează Generarea
            </Typography>
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    Subiecte Custom (opțional)
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Lasă lista goală pentru a folosi automat subiecte trending din România
                  </Typography>
                  
                  <Box sx={{ display: 'flex', mb: 2 }}>
                    <TextField
                      fullWidth
                      label="Adaugă subiect"
                      variant="outlined"
                      value={newTopic}
                      onChange={(e) => setNewTopic(e.target.value)}
                      onKeyPress={handleKeyPress}
                      size="small"
                    />
                    <Button 
                      startIcon={<AddCircleIcon />} 
                      onClick={handleAddTopic} 
                      variant="contained" 
                      sx={{ ml: 1 }}
                      disabled={!newTopic.trim()}
                    >
                      Adaugă
                    </Button>
                  </Box>
                  
                  {customTopics.length > 0 ? (
                    <List dense sx={{ bgcolor: 'background.paper', borderRadius: 1, border: '1px solid #e0e0e0' }}>
                      {customTopics.map((topic, index) => (
                        <ListItem
                          key={index}
                          secondaryAction={
                            <IconButton edge="end" onClick={() => handleRemoveTopic(index)}>
                              <DeleteIcon />
                            </IconButton>
                          }
                        >
                          <ListItemText primary={topic} />
                        </ListItem>
                      ))}
                    </List>
                  ) : (
                    <Alert severity="info" sx={{ mb: 2 }}>
                      Se vor folosi subiecte trending din România
                    </Alert>
                  )}
                </Box>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    Opțiuni
                  </Typography>
                  
                  <TextField
                    fullWidth
                    label="Număr de articole de generat"
                    type="number"
                    variant="outlined"
                    InputProps={{ inputProps: { min: 1, max: 10 } }}
                    value={topicCount}
                    onChange={(e) => setTopicCount(Math.min(10, Math.max(1, parseInt(e.target.value) || 5)))}
                    sx={{ mb: 2 }}
                  />
                  
                  <FormControlLabel
                    control={
                      <Checkbox 
                        checked={forceRefresh} 
                        onChange={(e) => setForceRefresh(e.target.checked)}
                      />
                    }
                    label="Forțează regenerarea (ignoră verificarea de articole deja existente)"
                  />
                </Box>
              </Grid>
            </Grid>
            
            <Divider sx={{ my: 3 }} />
            
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                type="submit"
                variant="contained"
                color="primary"
                size="large"
                disabled={loading}
                startIcon={loading ? <CircularProgress size={20} /> : <SendIcon />}
              >
                {loading ? 'Se generează...' : 'Generează Articole'}
              </Button>
            </Box>
          </form>
        </Paper>
        
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}
        
        {result && (
          <Paper elevation={3} sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
              <NewspaperIcon sx={{ mr: 1 }} /> Articole Generate
            </Typography>
            
            <Alert severity="success" sx={{ mb: 3 }}>
              {result.message}
            </Alert>
            
            <Typography variant="subtitle1" gutterBottom>
              Subiecte procesate:
            </Typography>
            
            <Box sx={{ mb: 3 }}>
              {result.topics.map((topic: string, index: number) => (
                <Chip 
                  key={index} 
                  label={topic} 
                  color="primary" 
                  variant="outlined" 
                  sx={{ m: 0.5 }} 
                />
              ))}
            </Box>
            
            <Divider sx={{ my: 2 }} />
            
            <Typography variant="subtitle1" gutterBottom>
              Articole generate ({result.articles.length}):
            </Typography>
            
            <List>
              {result.articles.map((article: any, index: number) => (
                <ListItem key={index} sx={{ flexDirection: 'column', alignItems: 'flex-start', p: 2, mb: 2, border: '1px solid #e0e0e0', borderRadius: 1 }}>
                  <Typography variant="h6">{article.title}</Typography>
                  
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Publicat: {new Date(article.pub_date).toLocaleString('ro-RO')}
                  </Typography>
                  
                  <Typography variant="body2" sx={{ mb: 2 }}>
                    {article.content.substring(0, 250)}... 
                    <Link href={`/admin/articles/${article.id}`} passHref>
                      <Button color="primary" size="small">
                        Citește tot
                      </Button>
                    </Link>
                  </Typography>
                  
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Chip size="small" label="Viral" color="secondary" />
                    <Chip size="small" label={`ID: ${article.id}`} variant="outlined" />
                  </Box>
                </ListItem>
              ))}
              
              {result.articles.length === 0 && (
                <Alert severity="info">
                  Nu s-au generat articole noi. Încercați să folosiți opțiunea "Forțează regenerarea".
                </Alert>
              )}
            </List>
            
            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
              <Button 
                variant="outlined" 
                startIcon={<RefreshIcon />} 
                onClick={() => router.push('/admin/articles')}
              >
                Vezi Toate Articolele
              </Button>
            </Box>
          </Paper>
        )}
      </Box>
    </AdminLayout>
  );
} 