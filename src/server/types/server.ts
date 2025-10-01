import { SessionService } from '../services/session-service';

declare module '@hapi/hapi' {
  interface ServerApplicationState {
    sessionService: SessionService;
  }
}
