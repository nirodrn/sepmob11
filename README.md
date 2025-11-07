# Sewanagala Sales Frontend System

## Firebase Setup Instructions

### 1. Update Firebase Realtime Database Rules

Copy the rules from `firebase-rules.json` and paste them into your Firebase Console:

1. Go to Firebase Console → Realtime Database → Rules
2. Replace the existing rules with the content from `firebase-rules.json`
3. Click "Publish"

### 2. Current User Access

The system now shows debug information when access is denied. Check the browser console and the error screen to see:
- Your current role
- Email
- Name

### 3. Temporary Access for Testing

I've temporarily added existing system roles for testing:
- `WarehouseStaff`
- `ProductionManager` 
- `FinishedGoodsStoreManager`
- `PackingAreaManager`

These roles will have access to the Admin dashboard for testing purposes.

### 4. Creating Sales Users

To create proper sales users, you'll need to add users with these roles in your Firebase database:

```json
{
  "users": {
    "user_id_here": {
      "email": "dr1@company.com",
      "name": "Direct Representative 1",
      "role": "DirectRepresentative",
      "department": "Sales",
      "status": "active",
      "createdAt": 1757400000000
    }
  }
}
```

### 5. Available Sales Roles

- `DirectRepresentative` - Shop representatives
- `DirectShowroomManager` - Showroom managers  
- `DirectShowroomStaff` - Showroom staff
- `Distributor` - Distributors
- `DistributorRepresentative` - Distributor representatives
- `HeadOfOperations` - Operations management
- `MainDirector` - Main director
- `Admin` - System administrators

### 6. Testing the System

1. Login with your current account
2. Check the debug information on the access denied screen
3. The system will show your current role and user details
4. If you have one of the temporary roles, you'll get admin access

### 7. Production Setup

Once testing is complete:
1. Remove the temporary role access from `ProtectedRoute.tsx`
2. Create proper sales users with appropriate roles
3. Update Firebase rules as needed for your security requirements

## Features

- Role-based dashboards for all sales personnel
- Product request workflow with approval tracking
- Professional invoice generation
- Real-time inventory visibility
- Offline sales capture with sync
- Comprehensive analytics and reporting
- Mobile-responsive design
- Complete audit trails

## Security

- Firebase Authentication integration
- Role-based access control
- Secure database rules
- Audit logging for all actions
- Data validation and sanitization

11# sewanamob10101
# sepmob11
