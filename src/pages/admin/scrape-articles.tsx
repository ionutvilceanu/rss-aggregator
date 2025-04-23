import { useState } from 'react';
import { Button, Container, Typography, TextField, FormControlLabel, Checkbox, Paper, Grid, CircularProgress, Snackbar, Alert } from '@mui/material';
import Head from 'next/head';
import AdminLayout from '../../components/AdminLayout';
import ArticleCard from '../../components/ArticleCard';

function ScrapeArticlesPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [forceRefresh, setForceRefresh] = useState(false);
  const [limit, setLimit] = useState(5);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error' | 'warning' | 'info'
  });

  const handleScrape = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/scrapeArticles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          forceRefresh,
          limit,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'A apărut o eroare la extragerea articolelor');
      }

      setResult(data);
      setSnackbar({
        open: true,
        message: `Succes! ${data.articles.length} articole extrase`,
        severity: 'success'
      });
    } catch (error) {
      console.error('Eroare:', error);
      setError(error instanceof Error ? error.message : 'Eroare necunoscută');
      setSnackbar({
        open: true,
        message: error instanceof Error ? error.message : 'Eroare necunoscută',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  return (
    <AdminLayout>
      <Head>
        <title>Extrage Articole Complete - RSS Aggregator</title>
      </Head>
      <Container maxWidth="lg" sx={{ mt: 4, mb: 8 }}>
        <Paper sx={{ p: 4, mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Extrage Articole Complete (Web Scraping)
          </Typography>
          <Typography variant="body1" paragraph>
            Această funcționalitate extrage conținutul complet al articolelor direct de pe site-urile sursă.
            În loc să te bazezi doar pe fragmentele scurte furnizate de feed-urile RSS, aceasta va accesa fiecare articol
            și va extrage tot conținutul, inclusiv imagini și titluri.
          </Typography>

          <Grid container spacing={3} sx={{ mt: 2 }}>
            <Grid item xs={12} md={6}>
              <TextField
                label="Număr maxim de articole de procesat"
                type="number"
                value={limit}
                onChange={(e) => setLimit(parseInt(e.target.value) || 5)}
                fullWidth
                inputProps={{ min: 1, max: 20 }}
                helperText="Limitează numărul de articole procesate (1-20)"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={forceRefresh}
                    onChange={(e) => setForceRefresh(e.target.checked)}
                  />
                }
                label="Forțează reîmprospătarea (procesează articole indiferent dacă au fost deja extrase)"
              />
            </Grid>
          </Grid>

          <Button
            variant="contained"
            color="primary"
            onClick={handleScrape}
            disabled={loading}
            sx={{ mt: 3 }}
            startIcon={loading ? <CircularProgress size={20} color="inherit" /> : null}
          >
            {loading ? 'Se procesează...' : 'Extrage Articole Complete'}
          </Button>
        </Paper>

        {error && (
          <Alert severity="error" sx={{ mb: 4 }}>
            {error}
          </Alert>
        )}

        {result && (
          <>
            <Typography variant="h5" gutterBottom sx={{ mt: 4 }}>
              Rezultat Extragere
            </Typography>
            <Typography variant="body1" paragraph>
              {result.message}
            </Typography>

            {result.articles && result.articles.length > 0 ? (
              <Grid container spacing={3}>
                {result.articles.map((article: any) => (
                  <Grid item xs={12} key={article.id}>
                    <ArticleCard 
                      title={article.title}
                      content={article.content.substring(0, 300) + '...'}
                      imageUrl={article.image_url}
                      date={new Date(article.pub_date).toLocaleDateString('ro-RO')}
                      articleUrl={article.source_url}
                    />
                  </Grid>
                ))}
              </Grid>
            ) : (
              <Typography variant="body1" color="textSecondary">
                Nu au fost extrase articole noi.
              </Typography>
            )}
          </>
        )}
      </Container>

      <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={handleCloseSnackbar}>
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </AdminLayout>
  );
}

export default ScrapeArticlesPage; 