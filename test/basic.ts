import { GitHubClient } from '../src/client';
import * as dotenv from 'dotenv';

dotenv.config();

async function testClient() {
    const client = new GitHubClient();

    console.log('✅ GitHubClient initialized successfully');
    console.log('Token configured:', !!process.env.GITHUB_TOKEN);

    // If you have a real project, uncomment and test:
    // const project = await client.getProject('owner', 1);
    // console.log('Project:', project);
}

testClient().catch(console.error);
