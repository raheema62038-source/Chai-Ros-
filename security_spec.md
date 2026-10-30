# Chai Roz — Security Specification (Phase 0 TDD)

## 1. Data Invariants

1. **Zero Plain-Text Password Storage**: Neither `/users/{userId}` nor any other Firestore collection may ever accept a `password`, `passwordHash`, or `pin` field. Strict `.keys().hasOnly(...)` rejects any payload containing extra or shadow keys.
2. **PII & Profile Isolation (`/users/{userId}`)**:
   - A customer profile document ID `{userId}` must strictly match `request.auth.uid` and `incoming().uid == userId`.
   - `phone` must be a valid 10-digit Indian mobile number matching `^[6-9][0-9]{9}$`.
   - `role` on creation must be `'customer'` (unless created by a verified Admin). Customers cannot escalate their `role` on create or update.
   - `read` (`get` and `list`) is strictly restricted to the document owner (`request.auth.uid == userId` / `resource.data.uid == request.auth.uid`) or a verified Admin (`isAdmin()`).
3. **Order Ownership & Isolation (`/orders/{orderId}`)**:
   - An order cannot be created unless the customer has an existing profile document at `/users/$(request.auth.uid)` (`exists()` relational check).
   - `incoming().customerId` must strictly equal `request.auth.uid`.
   - `pinCode` must match the 6-digit Indian PIN code regex `^[1-9][0-9]{5}$`.
   - `deliveryAddress` must be a string between 10 and 300 characters.
   - On creation, `status` must be `'pending'` and `createdAt == request.time && updatedAt == request.time`.
   - Customers can `get` and `list` **only** orders where `resource.data.customerId == request.auth.uid`.
   - Terminal State Lock: Once an order reaches `'delivered'` or `'cancelled'`, non-admin users cannot update it. Customers can only transition their own `'pending'` order to `'cancelled'` (Action: CancelOrder), whereas Admins can transition `status` across valid states.
4. **Catalogue Integrity (`/products/{productId}`)**:
   - Only verified Admins (`isAdmin()`) can create, update, or delete products.
   - Authenticated users can read/list products where `resource.data.inStock == true` (or Admins can read all).
5. **Admin Separation (`/admins/{adminId}`)**:
   - Admin privileges require either a document in `/admins/$(request.auth.uid)` or the bootstrapped verified owner email (`raheema62038@gmail.com` with `request.auth.token.email_verified == true`).

---

## 2. The "Dirty Dozen" Adversarial Payloads

1. **Payload 1 (Plain-Text Password Injection in `/users/{uid}`)**:
   `{ uid: "user_1", name: "रमेश कुमार", phone: "9876543210", password: "secretPassword123", role: "customer", authMethod: "mobile_password", createdAt: SERVER_TIME, updatedAt: SERVER_TIME }` -> **REJECTED** by `.keys().hasOnly(...)`.
2. **Payload 2 (Self-Assigned Admin Role Escalation on Registration)**:
   `{ uid: "user_1", name: "रमेश कुमार", phone: "9876543210", role: "admin", authMethod: "mobile_password", createdAt: SERVER_TIME, updatedAt: SERVER_TIME }` -> **REJECTED** by `data.role == 'customer' || isAdmin()`.
3. **Payload 3 (Cross-User PII Profile Read)**:
   Authenticated `user_2` attempts `get(/users/user_1)` -> **REJECTED** by `request.auth.uid == userId || isAdmin()`.
4. **Payload 4 (Invalid Mobile Number Format)**:
   `{ uid: "user_1", name: "रमेश", phone: "12345", role: "customer", authMethod: "mobile_password", createdAt: SERVER_TIME, updatedAt: SERVER_TIME }` -> **REJECTED** by `data.phone.matches('^[6-9][0-9]{9}$')`.
5. **Payload 5 (Order Creation with Spoofed `customerId`)**:
   Authenticated `user_1` creates order with `{ customerId: "user_2", ... }` -> **REJECTED** by `incoming().customerId == request.auth.uid`.
6. **Payload 6 (Orphaned Order Creation without Customer Profile)**:
   Authenticated `user_no_profile` attempts `create(/orders/ord_1)` before `/users/user_no_profile` exists -> **REJECTED** by `exists(/databases/$(database)/documents/users/$(request.auth.uid))`.
7. **Payload 7 (Cross-Customer Order List / Query Scraping)**:
   Authenticated `user_2` runs `list(/orders)` without filtering by `customerId == 'user_2'` -> **REJECTED** by `resource.data.customerId == request.auth.uid || isAdmin()`.
8. **Payload 8 (Invalid Indian PIN Code in Order)**:
   `{ ..., pinCode: "00012", deliveryAddress: "मकान नंबर 12, गांधी नगर, जयपुर" }` -> **REJECTED** by `data.pinCode.matches('^[1-9][0-9]{5}$')`.
9. **Payload 9 (Order Status Shortcut on Create)**:
   Customer creates order with `status: "delivered"` -> **REJECTED** by `incoming().status == 'pending'`.
10. **Payload 10 (Terminal State Mutation)**:
    Customer attempts to update an already `'delivered'` or `'cancelled'` order -> **REJECTED** by `existing().status == 'pending'`.
11. **Payload 11 (Unverified Admin Email Spoofing)**:
    Attacker with `email: "raheema62038@gmail.com"` and `email_verified: false` attempts to read all orders or write to `/products/prod_1` -> **REJECTED** by `request.auth.token.email_verified == true`.
12. **Payload 12 (Customer Mutating Order Price during Cancel Action)**:
    Customer updates their order with `{ status: "cancelled", totalAmountInr: 1 }` -> **REJECTED** by `incoming().diff(existing()).affectedKeys().hasOnly(['status', 'updatedAt'])`.
