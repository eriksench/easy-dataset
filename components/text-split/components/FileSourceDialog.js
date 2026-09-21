'use client';

import { Dialog, DialogTitle, DialogContent, Grid, Button, Typography, Box } from '@mui/material';
import ComputerIcon from '@mui/icons-material/Computer';
import ApartmentIcon from '@mui/icons-material/Apartment';
import { useTranslation } from 'react-i18next';

export default function FileSourceDialog({ open, onClose, onLocal, onDepartment }) {
  const { t } = useTranslation();
  const options = [
    {
      icon: <ComputerIcon sx={{ fontSize: 42 }} />,
      title: t('textSplit.fileSource.local', { defaultValue: '本地文件' }),
      description: t('textSplit.fileSource.localDescription', { defaultValue: '从当前设备选择一个或多个文件' }),
      onClick: onLocal
    },
    {
      icon: <ApartmentIcon sx={{ fontSize: 42 }} />,
      title: t('textSplit.fileSource.department', { defaultValue: '部门文件' }),
      description: t('textSplit.fileSource.departmentDescription', { defaultValue: '从所属部门的文档库中选择' }),
      onClick: onDepartment
    }
  ];

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('textSplit.fileSource.title', { defaultValue: '选择文件来源' })}</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ pt: 1 }}>
          {options.map(option => (
            <Grid item xs={12} sm={6} key={option.title}>
              <Button
                variant="outlined"
                fullWidth
                onClick={option.onClick}
                sx={{ minHeight: 160, textTransform: 'none', p: 2 }}
              >
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                  {option.icon}
                  <Typography variant="h6">{option.title}</Typography>
                  <Typography variant="body2" color="text.secondary" align="center">
                    {option.description}
                  </Typography>
                </Box>
              </Button>
            </Grid>
          ))}
        </Grid>
      </DialogContent>
    </Dialog>
  );
}
