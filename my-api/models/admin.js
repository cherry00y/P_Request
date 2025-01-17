const path = require('path');
const connection = require('../config/config');


const Admin = {
    getRequest: function(callback) {
        connection.query(`
            SELECT 
            r.request_id AS 'Doc No.', 
            CASE 
                WHEN r.request_type = 'Repair Request' THEN it.issuetype_name
                WHEN r.request_type = 'New Request' THEN nr.subject
                ELSE NULL 
            END AS 'Subject',
            r.date AS 'Date',
            r.request_type AS 'Type',
            r.requestor AS 'Requester',
            r.status AS 'Status',
            rr.rank AS 'Rank'
        FROM 
            Request r
        LEFT JOIN 
            RepairRequest rr ON rr.request_id = r.request_id
        LEFT JOIN 
            NewRequest nr ON nr.request_id = r.request_id
        LEFT JOIN 
            IssueType it ON rr.subjectrr = it.issuetype_id
        LEFT JOIN 
            Ranks rk ON rr.rank = rk.rank_id 
        WHERE 
            r.status = 'Request'`,callback)
    },

    getDetailRepair: function(request_id,callback) {
        connection.query(`
            SELECT 
            r.request_id AS 'Doc No.', 
            r.requestor AS 'Requestor',
            r.date AS 'Date',
            rk.description AS 'Rank',
            it.issuetype_name AS 'Subject', 
            lp.lineprocess_name AS 'Line Process', 
            rr.station AS 'Station',
            CASE 
                WHEN rr.linestop = 0 THEN NULL
                ELSE 'เกิด Line Stop'
            END AS 'Line Stop', 
            rr.problem AS 'Detail'
        FROM 
            Request r
        LEFT JOIN 
            RepairRequest rr ON rr.request_id = r.request_id
        LEFT JOIN 
            IssueType it ON rr.subjectrr = it.issuetype_id 
        LEFT JOIN 
            Lineprocess lp ON rr.lineprocess = lp.lineprocess_id 
        LEFT JOIN 
            Ranks rk ON rr.rank = rk.rank_id  -- Join with RankDescriptions table
        WHERE 
            r.request_type = 'Repair Request' 
        AND 
            r.request_id = ?`,[request_id], callback)
    },

    getDetailNewRequest: function(request_id,callback) {
        connection.query(`
            SELECT 
            r.request_id AS 'Doc No.', 
            r.requestor AS 'Requestor', 
            r.date AS 'Date', 
            jb.jobtype_name AS 'JobType', 
            nr.subject As 'Subject', 
            lp.lineprocess_name AS 'Line Process', 
            nr.station AS 'Station', 
            nr.cause As 'Cause', 
            nr.detail AS 'Detail',
            nr.newrequest_id As 'NewRequestID'
        FROM 
            Request r 
        LEFT JOIN
            NewRequest nr ON nr.request_id = r.request_id 
        LEFT JOIN 
            JobType jb ON nr.job_type = jb.jobtype_id 
        LEFT JOIN 
            Lineprocess lp ON nr.lineprocess = lp.lineprocess_id 
        WHERE 
            r.request_type = 'New Request' 
        AND 
            r.request_id = ?`, [request_id], callback)
    },

    rejectRequest: function (request_id, data, callback) {

        const { status, sup_ke} = data;

        const updateQuery = `
        UPDATE Request
        SET 
            status = ?,
            sup_ke = ?
        WHERE 
            request_id = ?`;
        
        const values = [status, sup_ke, request_id];

        connection.query(updateQuery, values, callback)
    },
    

    acceptRequest: function(request_id, data, callback){
        const { status, sup_ke, duedate } = data;

        const updateQuery = `
        UPDATE Request 
        SET  
            status = ?,
            sup_ke = ?,
            duedate = ? 
        WHERE 
            request_id = ?`;

        const values = [status, sup_ke, duedate, request_id];

        connection.query(updateQuery, values, callback);
     },


    getProduct: function(callback) {
        connection.query(`SELECT * FROM Product;`, callback)
     },


    cost: function(newrequest_id, repairlog_id, costdata, callback) {

        if (!newrequest_id && !repairlog_id) {
            return callback(new Error('Either newrequest_id or repairlog_id is required'), null);
        }
        
        const type = newrequest_id ? 'New Request' : 'Repair Request';
        
        const query = `
            INSERT INTO Cost (newrequest_id, repairlog_id, type, productname, price, quantity) 
            VALUES (?, ?, ?, ?, ?, ?)`;
            
        connection.query(query, [
            newrequest_id || null,
            repairlog_id || null,
            type,
            costdata.productname, // ส่งค่าที่ตรวจสอบแล้ว
            costdata.price,
            costdata.quantity
        ], (error, results) => {
            if (error) {
                console.error('Error inserting cost data:', error);
                callback(error, null);
            } else {
                callback(null, results);
            }
        });
    },

    getInformation: function(callback) {
        connection.query(`SELECT 
            YEAR(r.date) AS year, 
            MONTH(r.date) AS month, 
            r.request_id,
            r.date,
            r.status, 
            r.requestor, 
            r.sup_ke,
            r.request_type,
            CASE 
                WHEN r.request_type = 'Repair Request' THEN it.issuetype_name
                WHEN r.request_type = 'New Request' THEN nr.subject
                ELSE NULL 
            END AS Subject 
        FROM 
            Request r 
        LEFT JOIN 
            NewRequest nr ON nr.request_id = r.request_id
        LEFT JOIN 
            RepairRequest rr ON rr.request_id = r.request_id
        LEFT JOIN 
            IssueType it ON rr.subjectrr = it.issuetype_id
        WHERE 
            r.status IN ('waiting for goods', 'Out of Stock') -- ใช้ IN แทน AND
        ORDER BY 
            year DESC, month DESC;

        `, callback)
    },
        
    getCompletedInformRepair: function(callback) {
        connection.query(`
            SELECT 
            r.request_id AS 'Doc No.',
            r.requestor AS 'Requester',
            it.issuetype_name AS 'Subject',
            r.request_type AS 'Type', 
            r.status AS 'Status' ,
            rp.repairlog_id AS 'Repairlog_id'
        FROM
            Request r
        LEFT JOIN
            RepairRequest rr ON rr.request_id = r.request_id
        LEFT JOIN
            IssueType it ON rr.subjectrr = it.issuetype_id
        LEFT JOIN
            Repairlog rp ON r.request_id = rp.request_id
        WHERE
            r.status IN ('Completed') 
            AND r.request_type = 'Repair Request'`, callback)
    },

    getCompletedInformNew: function(callback) {
        connection.query(`
            SELECT 
            r.request_id AS 'Doc No.',
            r.requestor AS 'Requester',
            nr.subject AS 'Subject',
            rp.implement_end AS 'DataComplete',
            r.request_type AS 'Type', 
            r.status AS 'Status'
        FROM
            Request r
        LEFT JOIN
            NewRequest nr ON nr.request_id = r.request_id
        LEFT JOIN
            Repairlog rp ON rp.request_id = r.request_id
        WHERE
            r.status = 'Completed' 
            AND r.request_type = 'New Request';`, callback)
    },

    getAllRepairRequest: function(request_id, callback) {
        connection.query(`
            SELECT 
            r.request_id AS 'Doc No.', 
            CASE 
                WHEN r.request_type = 'Repair Request' THEN it.issuetype_name
                ELSE NULL 
            END AS 'Subject',
            r.date AS 'Date',
            r.requestor AS 'Requester',
            rk.description AS 'Rank',
            lp.lineprocess_name AS 'Lineprocess',
            rr.station AS 'Station',
            CASE 
                WHEN rr.linestop = 0 THEN NULL
                ELSE 'เกิด Line Stop'
            END AS 'Line Stop',
            rr.problem AS 'Problem',
            r.sup_ke AS 'SupAccept',
            rl.cause AS 'Cause',
            rl.solution AS 'Solution',
            rl.comment AS 'Comment',
            rl.operator_name AS 'Operator',
            t.torque_label AS 'Torquelabel',
            t.torque_check1 AS 'Torquecheck1',
            t.torque_check2 AS 'Torquecheck2',
            t.torque_check3 AS 'Torquecheck3',
            ts.name AS 'Typescrewdriver',
            sd.serial_no AS 'Serial No',
            sd.speed AS 'Speed',
            GROUP_CONCAT(c.productname SEPARATOR ', ') AS 'List',
            GROUP_CONCAT(c.quantity SEPARATOR ', ') AS 'Quantity',
            GROUP_CONCAT(c.price SEPARATOR ', ') AS 'Price per Unit',
            SUM(c.price * c.quantity) AS 'Total Cost',
            d.numberdoc AS 'Document',
            rl.implement_start AS 'Timestart',
            rl.implement_end AS 'Timeend',
            -- หาผลรวมเวลาที่ใช้ในการทำงาน
            SEC_TO_TIME(SUM(TIMESTAMPDIFF(SECOND, rl.implement_start, rl.implement_end))) AS 'TotalWorkTime'
        FROM 
            Request r
        LEFT JOIN 
            RepairRequest rr ON rr.request_id = r.request_id
        LEFT JOIN 
            IssueType it ON rr.subjectrr = it.issuetype_id
        LEFT JOIN 
            Ranks rk ON rr.rank = rk.rank_id
        LEFT JOIN 
            Lineprocess lp ON rr.lineprocess = lp.lineprocess_id
        LEFT JOIN 
            Repairlog rl ON rl.request_id = r.request_id 
        LEFT JOIN 
            Torque t ON t.repairlog_id = rl.repairlog_id  
        LEFT JOIN 
            Screwdriver sd ON sd.repairlog_id = rl.repairlog_id
        LEFT JOIN 
            Cost c ON c.repairlog_id = rl.repairlog_id
        LEFT JOIN 
            TypeScrewdriver ts ON sd.typesd = ts.typesd_id
        LEFT JOIN
            Document d ON d.repairlog_id = rl.repairlog_id
        WHERE 
            r.request_id = ?
        GROUP BY 
            r.request_id, 
            it.issuetype_name, 
            r.date, 
            r.requestor, 
            rk.description,
            lp.lineprocess_name,
            rr.station,
            rr.linestop,
            rr.problem,
            r.sup_ke,
            rl.cause, 
            rl.solution, 
            rl.comment, 
            rl.operator_name,
            t.torque_label, 
            t.torque_check1, 
            t.torque_check2, 
            t.torque_check3, 
            ts.name, 
            sd.serial_no, 
            sd.speed,
            d.numberdoc,
            rl.implement_start,
            rl.implement_end;`,[request_id], callback)
    },

    getAllNewRequest: function(request_id, callback) {
        connection.query(`
            SELECT 
            r.request_id AS 'Doc No.', 
            CASE 
                WHEN r.request_type = 'New Request' THEN nr.subject
                ELSE NULL 
            END AS 'Subject',
            r.date AS 'Date',
            r.requestor AS 'Requester',
            lp.lineprocess_name AS 'Lineprocess',
            jt.jobtype_name AS 'JobType',
            nr.station AS 'Station',
            nr.cause AS 'CauseRequest',
            nr.detail AS 'Detail',
            r.sup_ke AS 'SupAccept',
            rl.cause AS 'Cause',
            rl.solution AS 'Solution',
            rl.comment AS 'Comment',
            rl.operator_name AS 'Operator',
            t.torque_label AS 'Torquelabel',
            t.torque_check1 AS 'Torquecheck1',
            t.torque_check2 AS 'Torquecheck2',
            t.torque_check3 AS 'Torquecheck3',
            ts.name AS 'Typescrewdriver',
            sd.serial_no AS 'Serial No',
            sd.speed AS 'Speed',
            GROUP_CONCAT(c.productname SEPARATOR ', ') AS 'List',
            GROUP_CONCAT(c.quantity SEPARATOR ', ') AS 'Quantity',
            GROUP_CONCAT(c.price SEPARATOR ', ') AS 'Price per Unit',
            SUM(c.price * c.quantity) AS 'Total Cost',
            d.numberdoc AS 'Document'
        FROM 
            Request r
        LEFT JOIN 
            NewRequest nr ON nr.request_id = r.request_id
        LEFT JOIN 
            JobType jt ON nr.job_type = jt.jobtype_id
        LEFT JOIN 
            Lineprocess lp ON nr.lineprocess = lp.lineprocess_id
        LEFT JOIN 
            Repairlog rl ON rl.request_id = r.request_id 
        LEFT JOIN 
            Torque t ON t.repairlog_id = rl.repairlog_id  
        LEFT JOIN 
            Screwdriver sd ON sd.repairlog_id = rl.repairlog_id
        LEFT JOIN 
            Cost c ON c.newrequest_id = nr.newrequest_id
        LEFT JOIN 
            TypeScrewdriver ts ON sd.typesd = ts.typesd_id
        LEFT JOIN
        	Document d ON d.repairlog_id = rl.repairlog_id
        WHERE 
            r.request_id = ?
        GROUP BY 
            r.request_id, 
            nr.subject,
            r.date, 
            r.request_type, 
            r.requestor, 
            r.status, 
            lp.lineprocess_name,
            nr.station,
            jt.jobtype_name,
            nr.station,
            nr.cause,
            nr.detail,
            r.sup_ke,
            rl.cause, 
            rl.solution, 
            rl.comment, 
            rl.operator_name,
            t.torque_label, 
            t.torque_check1, 
            t.torque_check2, 
            t.torque_check3, 
            ts.name, 
            sd.serial_no, 
            sd.speed,
            d.numberdoc ;`,[request_id], callback)
    },

    getDocument: function(callback) {
        connection.query(`
            SELECT 
            r.request_id AS 'Doc No.', 
            CASE 
                WHEN r.request_type = 'Repair Request' THEN it.issuetype_name
                WHEN r.request_type = 'New Request' THEN nr.subject
                ELSE NULL
            END AS 'Subject',
            r.date AS 'Date',
            r.requestor AS 'Requester',
            r.request_type AS 'RequestType',
            r.status AS 'Status',
            r.sup_ke AS 'SupAccept',
            rl.operator_name AS 'Operator',
            d.numberdoc AS 'Document'
        FROM 
            Request r
        LEFT JOIN 
            RepairRequest rr ON rr.request_id = r.request_id
        LEFT JOIN 
            NewRequest nr ON nr.request_id = r.request_id
        LEFT JOIN 
            IssueType it ON rr.subjectrr = it.issuetype_id
        LEFT JOIN 
            Repairlog rl ON rl.request_id = r.request_id 
        LEFT JOIN 
            Document d ON d.repairlog_id = rl.repairlog_id
        WHERE 
            r.status = 'Completed' 
            AND d.numberdoc IS NOT NULL;`, callback)
    },

};


module.exports = Admin;