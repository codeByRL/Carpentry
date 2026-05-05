// backend/controllers/notificationController.js
import Notification from '../models/Notification.js'; // ייבוא המודל הקיים שלך

// פונקציה לקבלת התראות עבור משתמש מחובר
export const getNotifications = async (req, res) => {
    try {
        // req.user._id אמור להיות זמין אם ה-authenticate middleware עובד.
        // המודל שלך משתמש ב- 'user' כשדה עבור הנמען.
        const userId = req.user._id; 
        const notifications = await Notification.find({ user: userId }).sort({ createdAt: -1 });
        res.status(200).json(notifications);
    } catch (error) {
        console.error('שגיאה בטעינת התראות:', error);
        res.status(500).json({ message: 'שגיאה פנימית בשרת בעת טעינת התראות', error: error.message });
    }
};

// פונקציה לסימון התראה כנקראת
export const markNotificationRead = async (req, res) => {
    try {
        const { id } = req.params;
        const notification = await Notification.findById(id);

        if (!notification) {
            return res.status(404).json({ message: 'התראה לא נמצאה' });
        }

        // ודא שהמשתמש המחובר הוא המשתמש של ההתראה (recipient)
        if (notification.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'אין לך הרשאה לגשת להתראה זו' });
        }

        notification.isRead = true;
        await notification.save();
        res.status(200).json(notification);
    } catch (error) {
        console.error('שגיאה בסימון התראה כנקראת:', error);
        res.status(500).json({ message: 'שגיאה פנימית בשרת בעת סימון התראה כנקראת', error: error.message });
    }
};