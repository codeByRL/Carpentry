import { createTheme } from '@mui/material/styles';

/**
 * ערכת נושא אחידה להגשת פרויקט — חמים, מקצועיים, RTL.
 */
export function createAppTheme() {
  return createTheme({
    direction: 'rtl',
    palette: {
      mode: 'light',
      primary: {
        main: '#6D4C41',
        light: '#8D6E63',
        dark: '#4E342E',
        contrastText: '#FFFFFF',
      },
      secondary: {
        main: '#D2691E',
        light: '#E5915A',
        dark: '#A0522D',
        contrastText: '#FFFFFF',
      },
      background: {
        default: '#F3EDE6',
        paper: '#FFFBF7',
      },
      text: {
        primary: '#3E2723',
        secondary: '#6D5346',
      },
      divider: 'rgba(62, 39, 35, 0.12)',
      success: { main: '#2E7D32' },
      warning: { main: '#ED6C02' },
      error: { main: '#C62828' },
      info: { main: '#1565C0' },
    },
    shape: {
      borderRadius: 12,
    },
    typography: {
      fontFamily: '"Rubik", "Segoe UI", "Helvetica Neue", Arial, sans-serif',
      h4: { fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.25 },
      h5: { fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.3 },
      h6: { fontWeight: 700, lineHeight: 1.35 },
      subtitle1: { fontWeight: 600 },
      subtitle2: { fontWeight: 600, fontSize: '0.875rem' },
      button: { fontWeight: 600, textTransform: 'none', letterSpacing: '0.02em' },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          html: { WebkitTextSizeAdjust: '100%' },
          '#root': { minWidth: 0, minHeight: '100dvh' },
          body: { backgroundColor: '#F3EDE6' },
        },
      },
      MuiDialog: {
        defaultProps: { fullWidth: true },
        styleOverrides: {
          paper: {
            borderRadius: 16,
            backgroundImage: 'none',
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            boxShadow: 'none',
            '&:hover': { boxShadow: '0 2px 8px rgba(62, 39, 35, 0.12)' },
          },
          containedPrimary: {
            background: 'linear-gradient(180deg, #7E574C 0%, #5D4037 100%)',
          },
          containedSecondary: {
            background: 'linear-gradient(180deg, #E0803A 0%, #D2691E 100%)',
          },
        },
      },
      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
          elevation1: { boxShadow: '0 2px 12px rgba(62, 39, 35, 0.07)' },
          elevation2: { boxShadow: '0 4px 20px rgba(62, 39, 35, 0.09)' },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 14,
            border: '1px solid rgba(62, 39, 35, 0.1)',
            boxShadow: '0 2px 14px rgba(62, 39, 35, 0.06)',
            backgroundImage: 'none',
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': { borderRadius: 10 },
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: { root: { borderRadius: 10 } },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            boxShadow: '0 1px 0 rgba(62, 39, 35, 0.08)',
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: { backgroundImage: 'none' },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          head: {
            fontWeight: 700,
            fontSize: '0.8125rem',
            color: '#4E342E',
            backgroundColor: 'rgba(109, 76, 65, 0.06)',
            borderBottom: '1px solid rgba(62, 39, 35, 0.12)',
          },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            '&:last-child td': { borderBottom: 0 },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { fontWeight: 600, borderRadius: 8 },
        },
      },
      MuiTabs: {
        styleOverrides: {
          indicator: { height: 3, borderRadius: '3px 3px 0 0' },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: { fontWeight: 600, textTransform: 'none' },
        },
      },
      MuiAlert: {
        styleOverrides: {
          root: { borderRadius: 12, alignItems: 'center' },
          standardInfo: { backgroundColor: 'rgba(21, 101, 192, 0.08)' },
          standardSuccess: { backgroundColor: 'rgba(46, 125, 50, 0.08)' },
          standardWarning: { backgroundColor: 'rgba(237, 108, 2, 0.1)' },
          standardError: { backgroundColor: 'rgba(198, 40, 40, 0.08)' },
        },
      },
      MuiToggleButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 600,
            borderRadius: 10,
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: { fontSize: '0.8rem', borderRadius: 8 },
        },
      },
    },
  });
}
