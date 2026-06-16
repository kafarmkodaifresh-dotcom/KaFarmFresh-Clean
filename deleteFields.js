const admin = require('firebase-admin');

// Initialize Firebase Admin SDK with your service account
// If you have a service account JSON file, replace the path below
admin.initializeApp({
  credential: admin.credential.applicationDefault()
});

const db = admin.firestore();

async function deleteCollection(collectionPath, batchSize = 100) {
  const collectionRef = db.collection(collectionPath);
  const query = collectionRef.limit(batchSize);

  return new Promise((resolve, reject) => {
    deleteQueryBatch(query, batchSize, resolve, reject);
  });
}

async function deleteQueryBatch(query, batchSize, resolve, reject) {
  try {
    const snapshot = await query.get();
    
    if (snapshot.size === 0) {
      resolve();
      return;
    }

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    console.log(`Deleted ${snapshot.size} documents from ${query.firestore._referencePath}`);

    // Recurse on the next batch
    process.nextTick(() => {
      deleteQueryBatch(query, batchSize, resolve, reject);
    });
  } catch (error) {
    reject(error);
  }
}

async function deleteSubcollections(collectionPath) {
  const collectionRef = db.collection(collectionPath);
  const documents = await collectionRef.listDocuments();
  
  for (const doc of documents) {
    const subcollections = await doc.listCollections();
    for (const subcollection of subcollections) {
      await deleteCollection(subcollection.path);
    }
  }
}

async function main() {
  try {
    console.log('Starting deletion of fields collection...');
    await deleteSubcollections('fields');
    await deleteCollection('fields');
    console.log('✅ Successfully deleted all fields and subcollections.');
  } catch (error) {
    console.error('❌ Delete failed:', error);
  }
}

main();
