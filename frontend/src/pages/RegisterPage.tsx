*** Begin Patch
*** Update File: frontend/src/pages/RegisterPage.tsx
@@
-      if (res.error) {
-        if (res.error.code === 'NETWORK_ERROR') {
-          login({
-            id: `user-${Date.now()}`,
-            email: form.email,
-            firstName: form.email.split('@')[0],
-            lastName: '',
-            role: 'user',
-            kycStatus: 'pending',
-            mfaEnabled: false,
-            createdAt: new Date().toISOString(),
-            lastLoginAt: new Date().toISOString(),
-          }, 'demo-token');
-          navigate('/onboarding');
-          return;
-        }
-        setServerError(res.error.message || 'Registration failed.');
-      }
+      if (res.error) {
+        if (res.error.code === 'NETWORK_ERROR') {
+          // Backend unreachable — surface an explicit server error to the user instead of demo-login
+          setServerError('Network error: unable to reach the registration service. Please try again later.');
+          setLoading(false);
+          return;
+        }
+        setServerError(res.error.message || 'Registration failed.');
+      }
@@
-    } catch {
-      login({
-        id: `user-${Date.now()}`,
-        email: form.email,
-        firstName: form.email.split('@')[0],
-        lastName: '',
-        role: 'user',
-        kycStatus: 'pending',
-        mfaEnabled: false,
-        createdAt: new Date().toISOString(),
-        lastLoginAt: new Date().toISOString(),
-      }, 'demo-token');
-      navigate('/onboarding');
-    } finally {
+    } catch {
+      setServerError('Unexpected error during registration. Please try again later.');
+    } finally {
       setLoading(false);
     }
*** End Patch
