import { useState, useCallback } from 'react';
import { Snackbar, Alert } from '@mui/material';

/**
 * הודעות משוב קצרות (הצלחה / שגיאה / מידע) בתחתית המסך.
 */
export const useFeedbackSnackbar = () => {
  const [state, setState] = useState({ open: false, message: '', severity: 'success' });

  const showSuccess = useCallback((message) => {
    setState({ open: true, message, severity: 'success' });
  }, []);

  const showError = useCallback((message) => {
    setState({ open: true, message, severity: 'error' });
  }, []);

  const showInfo = useCallback((message) => {
    setState({ open: true, message, severity: 'info' });
  }, []);

  const close = useCallback(() => {
    setState((s) => ({ ...s, open: false }));
  }, []);

  const FeedbackSnackbar = () => (
    <Snackbar
      open={state.open}
      autoHideDuration={3800}
      onClose={close}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <Alert onClose={close} severity={state.severity} variant="filled" sx={{ width: '100%' }}>
        {state.message}
      </Alert>
    </Snackbar>
  );

  return { showSuccess, showError, showInfo, FeedbackSnackbar };
};
