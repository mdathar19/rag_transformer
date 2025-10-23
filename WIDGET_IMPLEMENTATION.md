# Widget Implementation Documentation

## Overview
This document describes the implementation of the chat widget feature for the RAG Transformer platform. The widget allows users to embed a customizable chat interface on their websites.

## Features Implemented

### 1. Backend Components

#### A. Database Schema (`src/models/schemas.js`)
- Added `widgetSettingsSchema` to define widget configuration structure
- Fields include:
  - `enabled`: Boolean (default: false)
  - `greetingMessage`, `primaryColor`, `position`, `widgetTitle`, etc.
  - `settings`: Object for advanced configuration
  - `branding`: Object for branding options

#### B. Widget Manager Service (`src/services/widgetManager.js`)
- Manages widget settings CRUD operations
- Key methods:
  - `getSettings(brokerId)`: Fetch settings or return defaults
  - `updateSettings(brokerId, data)`: Create or update settings
  - `isWidgetEnabled(brokerId)`: Check if widget is active
  - `getDefaultSettings()`: Returns default configuration (widget disabled by default)

#### C. API Endpoints

**User Routes (`src/api/userRoutes.js`)** - Authenticated:
- `GET /api/v1/user/widget/:brokerId` - Get widget settings
- `PUT /api/v1/user/widget/:brokerId` - Update widget settings

**Widget Routes (`src/api/widgetRoutes.js`)** - Public (no auth):
- `GET /api/v1/widget/config/:brokerId` - Get public widget config
- `POST /api/v1/widget/chat` - Send chat messages from widget
- `GET /api/v1/widget/health` - Widget API health check

#### D. Widget Script (`public/chat-widget.js`)
- Embeddable JavaScript widget
- Features:
  - Loads configuration from API
  - Creates floating chat button
  - Chat window with messages
  - Real-time streaming responses
  - Customizable colors, position, and messages
  - Typing indicators
  - Session management

### 2. Frontend Components (Already Created)

#### A. Widget Settings Page (`src/pages/user/WidgetSettings.jsx`)
- Enable/disable widget toggle
- Greeting message customization
- Color picker for primary color
- Position selector
- Widget title and placeholder text
- Real-time preview
- Embed code generator with copy button

#### B. Widget Preview Component (`src/components/WidgetPreview.jsx`)
- Live preview of widget appearance
- Interactive demo
- Shows how widget will look on client websites

#### C. API Client (`src/api/userAPI.js`)
- `userWidgetAPI.getSettings()`
- `userWidgetAPI.updateSettings()`
- `userWidgetAPI.getScriptUrl()`

## How It Works

### 1. Setup Flow

```
1. User creates website in labs.runit.in
2. User navigates to Widget Settings
3. Widget is DISABLED by default
4. User customizes:
   - Colors
   - Messages
   - Position
   - Title
5. User enables widget
6. Settings are saved to database (widget_settings collection)
7. User copies embed code
8. User adds embed code to their website
```

### 2. Widget Loading Flow

```
1. Client website loads chat-widget.js with data-broker-id
2. Widget script fetches configuration from /api/v1/widget/config/:brokerId
3. If widget is disabled, script exits silently
4. If enabled, widget creates UI elements
5. Shows greeting message (if configured)
6. User can interact with chat
```

### 3. Chat Message Flow

```
1. User types message in widget
2. Widget sends POST to /api/v1/widget/chat with:
   - brokerId
   - query
   - sessionId
3. Backend validates widget is enabled
4. Backend processes query using existing RAG pipeline
5. Response streams back to widget
6. Widget displays response in chat window
```

## Database Collections

### widget_settings
```javascript
{
  brokerId: "PAYB18022021121103",
  enabled: false,  // DEFAULT: disabled
  greetingMessage: "Hi! How can I help you today?",
  primaryColor: "#9333ea",
  secondaryColor: "#f3f4f6",
  textColor: "#ffffff",
  position: "bottom-right",
  widgetTitle: "Chat Support",
  placeholderText: "Type your message...",
  settings: {
    showOnLoad: false,
    showGreeting: true,
    greetingDelay: 2000,
    showTypingIndicator: true,
    // ... more settings
  },
  branding: {
    showPoweredBy: true,
    customFooterText: ""
  },
  createdAt: ISODate("..."),
  updatedAt: ISODate("...")
}
```

## Embed Code Format

```html
<script>
(function(w, d, s, id) {
  w.RunItChat = w.RunItChat || function() {
    (w.RunItChat.q = w.RunItChat.q || []).push(arguments);
  };
  var js, fjs = d.getElementsByTagName(s)[0];
  if (d.getElementById(id)) return;
  js = d.createElement(s);
  js.id = id;
  js.src = 'https://brain.runit.in/chat-widget.js';
  js.setAttribute('data-broker-id', 'BROKER_ID_HERE');
  fjs.parentNode.insertBefore(js, fjs);
}(window, document, 'script', 'runit-chat-widget'));
</script>
```

## API Endpoints Summary

### Authenticated Endpoints (Require JWT)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/user/widget/:brokerId` | Get widget settings |
| PUT | `/api/v1/user/widget/:brokerId` | Update widget settings |

### Public Endpoints (No Auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/widget/config/:brokerId` | Get public widget config |
| POST | `/api/v1/widget/chat` | Send chat message |
| GET | `/api/v1/widget/health` | Health check |

## Security Features

1. **Widget Disabled by Default**: New widgets start disabled to prevent unauthorized use
2. **Ownership Validation**: Only website owners can modify widget settings
3. **Rate Limiting**: Chat endpoint uses rate limiter to prevent abuse
4. **Enabled Check**: Public endpoints verify widget is enabled before serving
5. **Session Management**: Each widget session gets unique ID
6. **XSS Protection**: All user input is escaped in widget
7. **CORS**: Proper CORS headers for cross-origin requests

## Environment Variables

No new environment variables required. Uses existing:
- `MONGODB_URI`: Database connection
- `PORT`: Server port (default: 3000)

## Files Modified/Created

### Backend:
- ✅ `src/models/schemas.js` - Added widgetSettingsSchema
- ✅ `src/services/widgetManager.js` - Created
- ✅ `src/api/userRoutes.js` - Added widget endpoints
- ✅ `src/api/widgetRoutes.js` - Created
- ✅ `src/api/routes.js` - Mounted widget routes
- ✅ `index.js` - Initialize widgetManager
- ✅ `public/chat-widget.js` - Created

### Frontend:
- ✅ `src/pages/user/WidgetSettings.jsx` - Created
- ✅ `src/components/WidgetPreview.jsx` - Created
- ✅ `src/api/userAPI.js` - Added userWidgetAPI
- ✅ `src/pages/user/UserDashboard.jsx` - Added widget route and sidebar

## Testing Checklist

### Backend:
- [ ] Start server and verify widgetManager initializes
- [ ] Test GET `/api/v1/user/widget/:brokerId` (requires auth)
- [ ] Test PUT `/api/v1/user/widget/:brokerId` (requires auth)
- [ ] Test GET `/api/v1/widget/config/:brokerId` (public)
- [ ] Test POST `/api/v1/widget/chat` (public)
- [ ] Verify widget disabled by default
- [ ] Verify ownership validation works

### Frontend:
- [ ] Navigate to Widget Settings page
- [ ] Test enable/disable toggle
- [ ] Test color picker
- [ ] Test position selector
- [ ] Verify live preview updates
- [ ] Test save functionality
- [ ] Test copy embed code
- [ ] Verify embed code contains correct brokerId

### Widget:
- [ ] Embed widget on test website
- [ ] Verify widget loads (or doesn't if disabled)
- [ ] Enable widget and verify it appears
- [ ] Test chat functionality
- [ ] Verify colors match settings
- [ ] Test position changes
- [ ] Verify greeting message shows
- [ ] Test typing indicator

## Future Enhancements

1. **Logo Upload**: Add company logo to widget header
2. **File Uploads**: Allow users to upload files in chat
3. **Analytics**: Track widget usage metrics
4. **Multi-language**: Support multiple languages
5. **Custom CSS**: Allow advanced CSS customization
6. **Widget Themes**: Pre-made theme templates
7. **Chat History**: Store and retrieve chat history
8. **Offline Messages**: Queue messages when API is down
9. **Proactive Messages**: Trigger messages based on user behavior
10. **A/B Testing**: Test different widget configurations

## Troubleshooting

### Widget Not Appearing
1. Check widget is enabled in settings
2. Verify embed code has correct brokerId
3. Check browser console for errors
4. Verify API endpoints are accessible
5. Check CORS settings

### Chat Not Working
1. Verify website has indexed content
2. Check rate limiting hasn't been exceeded
3. Verify sessionId is being sent
4. Check server logs for errors

### Styling Issues
1. Verify primary color is valid hex
2. Check for CSS conflicts with host website
3. Test in different browsers
4. Verify z-index is high enough

## Support

For issues or questions:
- Backend API: Check server logs
- Frontend UI: Check browser console
- Widget: Check browser console on client website
- Database: Check MongoDB Atlas logs

---

**Implementation Status**: ✅ Complete
**Version**: 1.0.0
**Last Updated**: 2025-10-23
