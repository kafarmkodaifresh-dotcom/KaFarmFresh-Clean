import { doc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

export const useDeleteWithReason = (auth) => {
  const getCurrentUser = () => {
    if (auth?.name) return auth.name;
    return 'unknown';
  };

  const softDeleteSchedule = async (scheduleId, reason) => {
    const deletedBy = getCurrentUser();
    try {
      await updateDoc(doc(db, 'schedule', scheduleId), {
        deletedAt: serverTimestamp(),
        deletedBy: deletedBy,
        changeReason: reason
      });
      await addDoc(collection(db, 'schedule', scheduleId, 'history'), {
        action: 'delete',
        reason: reason,
        deletedBy: deletedBy,
        timestamp: serverTimestamp()
      });
    } catch (error) {
      console.error('Error deleting schedule:', error);
      throw error;
    }
  };

  const softDeleteCustomer = async (customerId, reason) => {
    const deletedBy = getCurrentUser();
    try {
      await updateDoc(doc(db, 'customers', customerId), {
        deletedAt: serverTimestamp(),
        deletedBy: deletedBy,
        changeReason: reason
      });
      await addDoc(collection(db, 'customers', customerId, 'history'), {
        action: 'delete',
        reason: reason,
        deletedBy: deletedBy,
        timestamp: serverTimestamp()
      });
    } catch (error) {
      console.error('Error deleting customer:', error);
      throw error;
    }
  };

  const softDeleteWorker = async (workerId, reason) => {
    const deletedBy = getCurrentUser();
    try {
      await updateDoc(doc(db, 'workers', workerId), {
        deletedAt: serverTimestamp(),
        deletedBy: deletedBy,
        changeReason: reason
      });
      await addDoc(collection(db, 'workers', workerId, 'history'), {
        action: 'delete',
        reason: reason,
        deletedBy: deletedBy,
        timestamp: serverTimestamp()
      });
    } catch (error) {
      console.error('Error deleting worker:', error);
      throw error;
    }
  };

  const softDeletePestLog = async (pestLogId, reason) => {
    const deletedBy = getCurrentUser();
    try {
      await updateDoc(doc(db, 'pestlog', pestLogId), {
        deletedAt: serverTimestamp(),
        deletedBy: deletedBy,
        changeReason: reason
      });
      await addDoc(collection(db, 'pestlog', pestLogId, 'history'), {
        action: 'delete',
        reason: reason,
        deletedBy: deletedBy,
        timestamp: serverTimestamp()
      });
    } catch (error) {
      console.error('Error deleting pest log:', error);
      throw error;
    }
  };

  const softDeleteDefect = async (defectId, reason) => {
    const deletedBy = getCurrentUser();
    try {
      await updateDoc(doc(db, 'defects', defectId), {
        deletedAt: serverTimestamp(),
        deletedBy: deletedBy,
        changeReason: reason
      });
      await addDoc(collection(db, 'defects', defectId, 'history'), {
        action: 'delete',
        reason: reason,
        deletedBy: deletedBy,
        timestamp: serverTimestamp()
      });
    } catch (error) {
      console.error('Error deleting defect:', error);
      throw error;
    }
  };

  const softDeleteBill = async (billId, reason) => {
    const deletedBy = getCurrentUser();
    try {
      await updateDoc(doc(db, 'bills', billId), {
        deletedAt: serverTimestamp(),
        deletedBy: deletedBy,
        changeReason: reason
      });
      await addDoc(collection(db, 'bills', billId, 'history'), {
        action: 'delete',
        reason: reason,
        deletedBy: deletedBy,
        timestamp: serverTimestamp()
      });
    } catch (error) {
      console.error('Error deleting bill:', error);
      throw error;
    }
  };

  const softDeleteField = async (fieldId, reason) => {
    const deletedBy = getCurrentUser();
    try {
      await updateDoc(doc(db, 'fields', fieldId), {
        deletedAt: serverTimestamp(),
        deletedBy: deletedBy,
        changeReason: reason
      });
      await addDoc(collection(db, 'fields', fieldId, 'history'), {
        action: 'delete',
        reason: reason,
        deletedBy: deletedBy,
        timestamp: serverTimestamp()
      });
    } catch (error) {
      console.error('Error deleting field:', error);
      throw error;
    }
  };

  const softDeleteAdmin = async (adminId, reason) => {
    const deletedBy = getCurrentUser();
    try {
      await addDoc(collection(db, 'adminDeletionHistory'), {
        adminId: adminId,
        reason: reason,
        deletedBy: deletedBy,
        timestamp: serverTimestamp()
      });
    } catch (error) {
      console.error('Error logging admin deletion:', error);
      throw error;
    }
  };

  const softDeletePlant = async (plantId, reason) => {
    // Plant deletion is typically handled at the row level in CropPage
    // This is a placeholder for future use
    console.log(`Plant ${plantId} deletion requested: ${reason}`);
  };

  const softDeleteRow = async (rowId, reason) => {
    const deletedBy = getCurrentUser();
    try {
      await updateDoc(doc(db, 'rows', rowId), {
        deletedAt: serverTimestamp(),
        deletedBy: deletedBy,
        changeReason: reason
      });
      await addDoc(collection(db, 'rows', rowId, 'history'), {
        action: 'delete',
        reason: reason,
        deletedBy: deletedBy,
        timestamp: serverTimestamp()
      });
    } catch (error) {
      console.error('Error deleting row:', error);
      throw error;
    }
  };

  return {
    softDeleteSchedule,
    softDeleteCustomer,
    softDeleteWorker,
    softDeletePestLog,
    softDeleteDefect,
    softDeleteBill,
    softDeleteField,
    softDeleteAdmin,
    softDeletePlant,
    softDeleteRow
  };
};
