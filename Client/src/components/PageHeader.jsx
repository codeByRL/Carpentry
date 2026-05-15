import React from 'react';
import { Box, Typography } from '@mui/material';

/**
 * כותרת דף אחידה להגשה — כותרת, תיאור קצר, אזור פעולות (כפתורים).
 */
const PageHeader = ({ title, description, action }) => (
  <Box
    sx={{
      mb: 3,
      display: 'flex',
      flexDirection: { xs: 'column', md: 'row' },
      gap: 2,
      alignItems: { md: 'flex-start' },
      justifyContent: 'space-between',
    }}
  >
    <Box sx={{ minWidth: 0 }}>
      <Typography
        variant="h4"
        component="h1"
        color="primary"
        sx={{
          fontWeight: 800,
          letterSpacing: '-0.03em',
          fontSize: { xs: '1.45rem', sm: '1.85rem' },
          lineHeight: 1.2,
        }}
      >
        {title}
      </Typography>
      {description ? (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mt: 1, maxWidth: 800, lineHeight: 1.65, whiteSpace: 'pre-line' }}
        >
          {description}
        </Typography>
      ) : null}
    </Box>
    {action ? <Box sx={{ flexShrink: 0, width: { xs: '100%', md: 'auto' } }}>{action}</Box> : null}
  </Box>
);

export default PageHeader;
