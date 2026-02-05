# RoadSense Admin Dashboard

Web-based admin dashboard for managing the RoadSense pothole detection system.

## Features

- ✅ **Authentication** - Admin-only access with role verification
- ✅ **Dashboard** - Analytics with stats cards and charts
- ✅ **Map View** - Interactive Leaflet map with anomaly markers
- ✅ **Anomaly Management** - Full CRUD with filtering and verification
- ✅ **User Management** - Role management and user statistics
- ✅ **Real-time Data** - Live updates from Supabase

## Tech Stack

- **React 18** + TypeScript
- **Vite** - Fast build tool
- **Tailwind CSS** - Utility-first styling
- **Leaflet** - Interactive maps
- **Recharts** - Data visualization
- **Supabase** - Backend and authentication
- **React Query** - Data fetching and caching

## Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env and add your Supabase credentials
```

### 3. Run Development Server
```bash
npm run dev
```

The dashboard will be available at `http://localhost:3000`

### 4. Build for Production
```bash
npm run build
npm run preview
```

## Project Structure

```
web/
├── src/
│   ├── components/
│   │   ├── Layout/
│   │   │   ├── Sidebar.tsx      # Navigation sidebar
│   │   │   ├── Header.tsx       # Top header bar
│   │   │   └── Layout.tsx       # Main layout wrapper
│   │   └── AuthProvider.tsx     # Auth context
│   ├── pages/
│   │   ├── Login.tsx            # Admin login
│   │   ├── Dashboard.tsx        # Analytics dashboard
│   │   ├── MapView.tsx          # Interactive map
│   │   ├── AnomalyManagement.tsx # CRUD operations
│   │   └── UserManagement.tsx   # User admin
│   ├── lib/
│   │   ├── supabase.ts          # Supabase client
│   │   └── queries.ts           # Database queries
│   ├── App.tsx                  # Main app with routing
│   └── main.tsx                 # Entry point
├── index.html
├── vite.config.ts
├── tailwind.config.js
└── package.json
```

## Pages

### Dashboard (`/dashboard`)
- Total anomalies count
- Anomalies by type (pie chart)
- Recent detections list
- Verification statistics

### Map View (`/map`)
- Interactive Leaflet map
- Color-coded markers (red=pothole, yellow=bump)
- Marker popups with details
- Viewport-based loading

### Anomaly Management (`/anomalies`)
- Sortable table with all anomalies
- Filter by type and verification status
- Verify/delete actions
- Bulk operations

### User Management (`/users`)
- List all users with stats
- Change user roles (driver ↔ admin)
- View user contributions
- User statistics

## Environment Variables

Required in `.env`:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Admin Access

To create an admin user:

1. Sign up via mobile app or Supabase dashboard
2. In Supabase SQL Editor, run:
```sql
UPDATE profiles SET role = 'admin' WHERE email = 'your@email.com';
```

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

### Adding New Features

1. Create new page in `src/pages/`
2. Add route in `src/App.tsx`
3. Add navigation item in `src/components/Layout/Sidebar.tsx`
4. Create database queries in `src/lib/queries.ts`

## Deployment

### Vercel (Recommended)
```bash
npm install -g vercel
vercel
```

### Netlify
```bash
npm run build
# Upload dist/ folder to Netlify
```

### Environment Variables
Don't forget to add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in your deployment platform's environment settings.

## Troubleshooting

### Map not loading
- Check Leaflet CSS is imported in `index.html`
- Verify marker icons are loading from CDN

### Authentication fails
- Verify Supabase credentials in `.env`
- Check user has `role='admin'` in profiles table

### No data showing
- Ensure database setup script was run
- Check RLS policies allow admin access
- Verify anomalies exist in database

## License

MIT
