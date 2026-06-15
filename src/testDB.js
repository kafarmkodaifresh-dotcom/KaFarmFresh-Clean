import { localPut, localGet, localGetAll, localClear } from './services/localDB.js';

export const testLocalDB = async () => {
  console.log('🔄 Testing localDB...');
  try {
    // Write
    await localPut('plants', { id: 'test|1|1', name: 'Test Plant', flowers: 5 });
    console.log('✅ Write successful');
    
    // Read single
    const plant = await localGet('plants', 'test|1|1');
    console.log('✅ Read successful:', plant);
    
    // Read all
    const all = await localGetAll('plants');
    console.log('✅ Read all successful:', all.length);
    
    // Clean up
    await localClear('plants');
    console.log('✅ Cleanup successful');
    return true;
  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
};
