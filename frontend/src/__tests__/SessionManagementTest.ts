import { createNewSession } from '../lib/supabase';
import { expect } from 'chai';

describe('Session Management', () => {
    it('should create a new user session', async () => {
        const session = await createNewSession();
        expect(session).to.not.be.null;
        expect(session).to.have.property('id');
    });

    it('should not use an existing session when creating a new one', async () => {
        const initialSession = await createNewSession();
        const newSession = await createNewSession();
        expect(newSession.id).to.not.equal(initialSession.id);
    });
});
