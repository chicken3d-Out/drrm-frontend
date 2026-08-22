import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.getAccessToken();

  const authedReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` }, withCredentials: true })
    : req.clone({ withCredentials: true });

  return next(authedReq).pipe(
    catchError((err: HttpErrorResponse) => {
      const isAuthRoute = req.url.includes('/auth/login') || req.url.includes('/auth/register') || req.url.includes('/auth/refresh');
      if (err.status === 401 && !isAuthRoute) {
        return from(auth.refreshAccessToken()).pipe(
          switchMap((newToken) => {
            if (!newToken) {
              return throwError(() => err);
            }
            const retried = req.clone({ setHeaders: { Authorization: `Bearer ${newToken}` }, withCredentials: true });
            return next(retried);
          })
        );
      }
      return throwError(() => err);
    })
  );
};
