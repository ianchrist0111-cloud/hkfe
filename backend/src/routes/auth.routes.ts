*** Begin Patch
*** Update File: backend/src/routes/auth.routes.ts
@@
-// POST /auth/register
-router.post('/register', validateBody(registerSchema), async (req, res: Response) => {
-  try {
-    const { email, password, firstName, lastName } = req.body;
-    const normalizedEmail = String(email).toLowerCase().trim();
-
-    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
-    if (existingUser) {
-      return res.status(409).json({
-        success: false,
-        error: { code: 'EMAIL_IN_USE', message: 'An account with this email address already exists.' },
-      });
-    }
-
-    const passwordHash = await bcrypt.hash(password, 12);
-
-    const user = await prisma.user.create({
-      data: {
-        email: normalizedEmail,
-        passwordHash,
-        firstName: firstName || null,
-        lastName: lastName || null,
-        role: 'user',
-        status: 'active',
-        kycStatus: 'not_started',
-        emailVerified: false,
-        wallet: {
-          create: {
-            totalBalance: 0.0,
-            availableBalance: 0.0,
-            reservedTrading: 0.0,
-            reservedEarn: 0.0,
-            reservedBots: 0.0,
-            currency: 'USD',
-          },
-        },
-      },
-      include: { wallet: true },
-    });
-
-    await prisma.auditLog.create({
-      data: {
-        eventType: 'USER_REGISTERED',
-        actorId: user.id,
-        actorRole: user.role,
-        targetEntityType: 'user',
-        targetEntityId: user.id,
-        ipAddress: getClientIp(req),
-        userAgent: req.headers['user-agent'] || null,
-        metadata: JSON.stringify({ email: user.email }),
-      },
-    });
-
-    const code = Math.floor(100000 + Math.random() * 900000).toString();
-    const expiresAt = Date.now() + 10 * 60 * 1000;
-    emailOtpCodes.set(normalizedEmail, {
-      code,
-      purpose: 'verification',
-      expiresAt,
-      attempts: 1,
-    });
-
-    const emailSent = await sendOtpEmail({ to: normalizedEmail, otp: code, purpose: 'verification' });
-    if (!emailSent) {
-      logger.warn(`[EmailVerification] Registration OTP send failed for ${normalizedEmail}`);
-    }
-
-    res.status(201).json({
-      success: true,
-      data: {
-        message: 'Account created. Please verify your email address with the code sent to your inbox to complete signup.',
-        email: normalizedEmail,
-        emailVerified: false,
-        devCode: ENV.NODE_ENV !== 'production' ? code : undefined,
-      },
-    });
-  } catch (err: any) {
-    res.status(500).json({ success: false, error: { code: 'REGISTER_ERROR', message: err.message } });
-  }
-});
+// POST /auth/register
+router.post('/register', validateBody(registerSchema), async (req, res: Response) => {
+  try {
+    const { email, password, firstName, lastName } = req.body;
+    const normalizedEmail = String(email).toLowerCase().trim();
+
+    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
+    if (existingUser) {
+      return res.status(409).json({
+        success: false,
+        error: { code: 'EMAIL_IN_USE', message: 'An account with this email address already exists.' },
+      });
+    }
+
+    const passwordHash = await bcrypt.hash(password, 12);
+
+    // Create user with zero-balance simulated wallet and require email verification
+    const user = await prisma.user.create({
+      data: {
+        email: normalizedEmail,
+        passwordHash,
+        firstName: firstName || null,
+        lastName: lastName || null,
+        role: 'user',
+        status: 'active',
+        kycStatus: 'not_started',
+        emailVerified: false,
+        wallet: {
+          create: {
+            totalBalance: 0.0,
+            availableBalance: 0.0,
+            reservedTrading: 0.0,
+            reservedEarn: 0.0,
+            reservedBots: 0.0,
+            currency: 'USD',
+          },
+        },
+      },
+      include: { wallet: true },
+    });
+
+    await prisma.auditLog.create({
+      data: {
+        eventType: 'USER_REGISTERED',
+        actorId: user.id,
+        actorRole: user.role,
+        targetEntityType: 'user',
+        targetEntityId: user.id,
+        ipAddress: getClientIp(req),
+        userAgent: req.headers['user-agent'] || null,
+        metadata: JSON.stringify({ email: user.email }),
+      },
+    });
+
+    // generate email verification OTP, store it and send (or log in dev)
+    const code = Math.floor(100000 + Math.random() * 900000).toString();
+    const expiresAt = Date.now() + 10 * 60 * 1000;
+    emailOtpCodes.set(normalizedEmail, {
+      code,
+      purpose: 'verification',
+      expiresAt,
+      attempts: 1,
+    });
+
+    const emailSent = await sendOtpEmail({ to: normalizedEmail, otp: code, purpose: 'verification' });
+    if (!emailSent) {
+      logger.warn(`[EmailVerification] Registration OTP send failed for ${normalizedEmail}`);
+    }
+
+    // IMPORTANT: do NOT issue a token here. Require verify-email step.
+    res.status(201).json({
+      success: true,
+      data: {
+        message: 'Account created. Please verify your email address with the code sent to your inbox to complete signup.',
+        email: normalizedEmail,
+        emailVerified: false,
+        devCode: ENV.NODE_ENV !== 'production' ? code : undefined,
+      },
+    });
+  } catch (err: any) {
+    res.status(500).json({ success: false, error: { code: 'REGISTER_ERROR', message: err.message } });
+  }
+});
*** End Patch
