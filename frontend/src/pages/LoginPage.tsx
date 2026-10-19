*** Begin Patch
*** Update File: frontend/src/pages/LoginPage.tsx
@@
-      if (res.error) {
-        if (res.error.code === 'NETWORK_ERROR') {
-          // Backend is offline, fall back to persona login
-          const found = DEMO_PERSONAS.find(p => p.email.toLowerCase() === form.email.toLowerCase());
-          if (found) {
-            executeLocalFallback(found.email, found.firstName, found.lastName, found.role, found.kycStatus);
-          } else {
-            const isAdmin = form.email.toLowerCase().includes('admin');
-            executeLocalFallback(form.email, form.email.split('@')[0], '', isAdmin ? 'admin' : 'user', 'approved');
-          }
-          return;
-        }
-        setError(res.error.message || 'Invalid email or password.');
-      }
+      if (res.error) {
+        if (res.error.code === 'NETWORK_ERROR') {
+          // Backend is offline — show an explicit error so users aren't silently demo-logged in
+          setError('Network error: unable to reach the authentication service. Please try again later.');
+          setLoading(false);
+          return;
+        }
+        setError(res.error.message || 'Invalid email or password.');
+      }
@@
-    } catch {
-      // Fallback
-      const found = DEMO_PERSONAS.find(p => p.email.toLowerCase() === form.email.toLowerCase());
-      if (found) {
-        executeLocalFallback(found.email, found.firstName, found.lastName, found.role, found.kycStatus);
-      }
-    } finally {
+    } catch {
+      // Network or unexpected error — show an explicit message instead of silently demo-signin
+      setError('Unexpected error during login. Please check your connection and try again.');
+    } finally {
       setLoading(false);
     }
*** End Patch
