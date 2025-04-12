"""
Database utility for Person Detection System
"""
import os
import aiosqlite
import time

class Database:
    """
    SQLite database handler with WAL mode for performance
    """
    def __init__(self, db_path=None, max_size_mb=200):
        """
        Initialize database
        
        Args:
            db_path (str): Path to SQLite database file
            max_size_mb (int): Maximum database size in MB
        """
        if db_path is None:
            db_path = os.path.join(
                os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 
                'data/detection.db'
            )
            
        # Create directory if it doesn't exist
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
            
        self.db_path = db_path
        self.max_size_mb = max_size_mb
        self.connection = None
        
    async def initialize(self):
        """Initialize database connection and tables"""
        self.connection = await aiosqlite.connect(self.db_path)
        
        # Enable WAL mode for better performance
        await self.connection.execute("PRAGMA journal_mode=WAL;")
        
        # Create tables
        await self.connection.execute("""
        CREATE TABLE IF NOT EXISTS detections (
            timestamp INTEGER PRIMARY KEY,
            count INTEGER,
            confidence REAL
        );
        """)
        
        await self.connection.execute("""
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        );
        """)
        
        await self.connection.execute("""
        CREATE TABLE IF NOT EXISTS errors (
            timestamp INTEGER PRIMARY KEY,
            message TEXT,
            resolved INTEGER DEFAULT 0
        );
        """)
        
        await self.connection.commit()
    
    async def store_detection(self, count, confidence):
        """
        Store detection data
        
        Args:
            count (int): Number of persons detected
            confidence (float): Confidence level
            
        Returns:
            bool: Success status
        """
        if self.connection is None:
            await self.initialize()
            
        try:
            # Check if database size exceeds limit
            if await self._check_size() > self.max_size_mb:
                # Remove oldest records
                await self._cleanup_old_records()
                
            # Store detection
            timestamp = int(time.time())
            await self.connection.execute(
                "INSERT INTO detections (timestamp, count, confidence) VALUES (?, ?, ?)",
                (timestamp, count, confidence)
            )
            await self.connection.commit()
            return True
            
        except Exception as e:
            # Log error
            await self.log_error(f"Failed to store detection: {e}")
            return False
    
    async def get_recent_detections(self, minutes=10):
        """
        Get detections from the last N minutes
        
        Args:
            minutes (int): Number of minutes to look back
            
        Returns:
            list: List of detection records
        """
        if self.connection is None:
            await self.initialize()
            
        now = int(time.time())
        past = now - (minutes * 60)
        
        async with self.connection.execute(
            "SELECT timestamp, count, confidence FROM detections WHERE timestamp >= ? ORDER BY timestamp",
            (past,)
        ) as cursor:
            return await cursor.fetchall()
    
    async def get_paginated_detections(self, page=1, page_size=50):
        """
        Get paginated detection data
        
        Args:
            page (int): Page number (1-based)
            page_size (int): Items per page
            
        Returns:
            tuple: (records, total_count)
        """
        if self.connection is None:
            await self.initialize()
            
        # Calculate offset
        offset = (page - 1) * page_size
        
        # Get total count
        async with self.connection.execute(
            "SELECT COUNT(*) FROM detections"
        ) as cursor:
            total_count = (await cursor.fetchone())[0]
        
        # Get data
        async with self.connection.execute(
            "SELECT timestamp, count, confidence FROM detections ORDER BY timestamp DESC LIMIT ? OFFSET ?",
            (page_size, offset)
        ) as cursor:
            records = await cursor.fetchall()
            
        return records, total_count
    
    async def get_setting(self, key, default=None):
        """
        Get setting value
        
        Args:
            key (str): Setting key
            default: Default value if setting not found
            
        Returns:
            str: Setting value
        """
        if self.connection is None:
            await self.initialize()
            
        async with self.connection.execute(
            "SELECT value FROM settings WHERE key = ?",
            (key,)
        ) as cursor:
            result = await cursor.fetchone()
            
        if result is None:
            return default
        return result[0]
    
    async def set_setting(self, key, value):
        """
        Set setting value
        
        Args:
            key (str): Setting key
            value: Setting value
            
        Returns:
            bool: Success status
        """
        if self.connection is None:
            await self.initialize()
            
        try:
            await self.connection.execute(
                "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
                (key, str(value))
            )
            await self.connection.commit()
            
            # Run VACUUM after settings changes to optimize storage
            await self.connection.execute("PRAGMA auto_vacuum = INCREMENTAL;")
            await self.connection.execute("PRAGMA incremental_vacuum;")
            
            return True
            
        except Exception as e:
            await self.log_error(f"Failed to set setting: {e}")
            return False
    
    async def log_error(self, message):
        """
        Log error message
        
        Args:
            message (str): Error message
            
        Returns:
            bool: Success status
        """
        if self.connection is None:
            await self.initialize()
            
        try:
            timestamp = int(time.time())
            await self.connection.execute(
                "INSERT INTO errors (timestamp, message) VALUES (?, ?)",
                (timestamp, message)
            )
            await self.connection.commit()
            
            # Limit error log entries to last 1,000 items
            await self.connection.execute(
                """
                DELETE FROM errors 
                WHERE timestamp NOT IN (
                    SELECT timestamp FROM errors ORDER BY timestamp DESC LIMIT 1000
                )
                """
            )
            await self.connection.commit()
            return True
            
        except Exception as e:
            print(f"Critical error: Failed to log error: {e}")
            return False
    
    async def get_errors(self, resolved=False, limit=100):
        """
        Get error log entries
        
        Args:
            resolved (bool): Get resolved errors
            limit (int): Maximum number of errors to retrieve
            
        Returns:
            list: List of error records
        """
        if self.connection is None:
            await self.initialize()
            
        async with self.connection.execute(
            "SELECT timestamp, message FROM errors WHERE resolved = ? ORDER BY timestamp DESC LIMIT ?",
            (1 if resolved else 0, limit)
        ) as cursor:
            return await cursor.fetchall()
    
    async def mark_error_resolved(self, timestamp):
        """
        Mark error as resolved
        
        Args:
            timestamp (int): Error timestamp
            
        Returns:
            bool: Success status
        """
        if self.connection is None:
            await self.initialize()
            
        try:
            await self.connection.execute(
                "UPDATE errors SET resolved = 1 WHERE timestamp = ?",
                (timestamp,)
            )
            await self.connection.commit()
            return True
            
        except Exception as e:
            print(f"Failed to mark error as resolved: {e}")
            return False
    
    async def clear_resolved_errors(self):
        """
        Clear all resolved errors
        
        Returns:
            int: Number of cleared errors
        """
        if self.connection is None:
            await self.initialize()
            
        try:
            async with self.connection.execute(
                "DELETE FROM errors WHERE resolved = 1"
            ) as cursor:
                await self.connection.commit()
                return cursor.rowcount
                
        except Exception as e:
            await self.log_error(f"Failed to clear resolved errors: {e}")
            return 0
    
    async def _check_size(self):
        """
        Check database size in MB
        
        Returns:
            float: Database size in MB
        """
        try:
            size = os.path.getsize(self.db_path)
            return size / (1024 * 1024)  # Convert bytes to MB
        except OSError:
            return 0
    
    async def _cleanup_old_records(self):
        """
        Remove oldest records to keep database within size limit
        """
        try:
            # Delete oldest 10% of records
            async with self.connection.execute(
                "SELECT COUNT(*) FROM detections"
            ) as cursor:
                total = (await cursor.fetchone())[0]
                
            if total > 100:  # Only clean if we have enough records
                delete_count = max(int(total * 0.1), 100)  # Delete at least 100 records
                
                await self.connection.execute(
                    """
                    DELETE FROM detections 
                    WHERE timestamp IN (
                        SELECT timestamp FROM detections
                        ORDER BY timestamp ASC
                        LIMIT ?
                    )
                    """,
                    (delete_count,)
                )
                await self.connection.commit()
                
        except Exception as e:
            print(f"Failed to cleanup old records: {e}")
    
    async def close(self):
        """Close database connection"""
        if self.connection:
            await self.connection.close()
            self.connection = None
