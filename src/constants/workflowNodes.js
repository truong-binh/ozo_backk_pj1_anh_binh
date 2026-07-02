const WORKFLOW_NODES = [
  { code: 'A1', stage: 'A. Y tuong & Duyet', name: 'Phe duyet trien khai du an', dept: 'RD', defaultDuration: 15, defaultAfter: [] },
  { code: 'B1', stage: 'B. Nghien cuu bao che', name: 'Chuan bi nguyen lieu nghien cuu', dept: 'PP', defaultDuration: 15, defaultAfter: ['A1'] },
  { code: 'B2', stage: 'B. Nghien cuu bao che', name: 'Nghien cuu bao che', dept: 'RD', defaultDuration: 15, defaultAfter: ['B1'] },
  { code: 'B3', stage: 'B. Nghien cuu bao che', name: 'Danh gia cam quan', dept: 'RD', defaultDuration: 3, defaultAfter: ['B2'] },
  { code: 'B4', stage: 'B. Nghien cuu bao che', name: 'Danh gia tac dung so bo', dept: 'RD', defaultDuration: 15, defaultAfter: ['B2'] },
  { code: 'B5', stage: 'B. Nghien cuu bao che', name: 'Chot mau nghien cuu', dept: 'BGD', defaultDuration: 3, defaultAfter: ['B3', 'B4'] },
  { code: 'B6', stage: 'B. Nghien cuu bao che', name: 'Theo doi su on dinh', dept: 'RD', defaultDuration: 60, defaultAfter: ['B5'] },
  { code: 'B7', stage: 'B. Nghien cuu bao che', name: 'Order pha mau nha may', dept: 'RD', defaultDuration: 1, defaultAfter: ['B5'] },
  { code: 'B8', stage: 'B. Nghien cuu bao che', name: 'Xay dung ho so san pham du kien', dept: 'RD', defaultDuration: 3, defaultAfter: ['B5'] },
  { code: 'C1', stage: 'C. Bao bi', name: 'Mau bao bi', dept: 'PP', defaultDuration: 7, defaultAfter: ['A1'] },
  { code: 'C2', stage: 'C. Bao bi', name: 'Y tuong thiet ke', dept: 'TK', defaultDuration: 7, defaultAfter: ['B5'] },
  { code: 'C3', stage: 'C. Bao bi', name: 'Thiet ke bao bi', dept: 'TK', defaultDuration: 7, defaultAfter: ['E1'] },
  { code: 'C4', stage: 'C. Bao bi', name: 'Thiet ke duyet in', dept: 'TK', defaultDuration: 3, defaultAfter: ['E2'] },
  { code: 'D1', stage: 'D. Kha thi san xuat', name: 'Danh gia kha thi cong bo', dept: 'PC-DV', defaultDuration: 5, defaultAfter: ['B8'] },
  { code: 'D2', stage: 'D. Kha thi san xuat', name: 'Danh gia kha thi san xuat', dept: 'NCC', defaultDuration: 5, defaultAfter: ['B7'] },
  { code: 'D3', stage: 'D. Kha thi san xuat', name: 'Pha mau va sua mau', dept: 'NCC', defaultDuration: 20, defaultAfter: ['D2'] },
  { code: 'D4', stage: 'D. Kha thi san xuat', name: 'Phe duyet NCC gia cong', dept: 'PP', defaultDuration: 7, defaultAfter: ['D3'] },
  { code: 'D5', stage: 'D. Kha thi san xuat', name: 'Theo doi do on dinh chinh thuc tai nha may', dept: 'NCC', defaultDuration: 90, defaultAfter: ['D4'] },
  { code: 'E1', stage: 'E. Cong bo', name: 'Soan ho so cong bo', dept: 'PC-DV', defaultDuration: 7, defaultAfter: ['D4'] },
  { code: 'E2', stage: 'E. Cong bo', name: 'Duyet ho so', dept: '', defaultDuration: 15, defaultAfter: ['E1', 'C3'] },
  { code: 'E3', stage: 'E. Cong bo', name: 'Dang ky quang cao', dept: 'PC', defaultDuration: 20, defaultAfter: ['E2'] },
  { code: 'F1', stage: 'F. Ra mat & Truyen thong', name: 'Dao tao san pham', dept: 'RD', defaultDuration: 7, defaultAfter: ['E2'] },
  { code: 'F2', stage: 'F. Ra mat & Truyen thong', name: 'Chuan bi launching', dept: 'Sale', defaultDuration: 30, defaultAfter: ['F1'] },
  { code: 'G1', stage: 'G. San xuat lo dau', name: 'Xay dung tai lieu san xuat', dept: 'RD', defaultDuration: 7, defaultAfter: ['C4', 'E2'] },
  { code: 'G2', stage: 'G. San xuat lo dau', name: 'San xuat lo dau va kiem nghiem', dept: 'PP', defaultDuration: 60, defaultAfter: ['G1'] },
  { code: 'G3', stage: 'G. San xuat lo dau', name: 'Kiem tra cam quan mau', dept: 'RD', defaultDuration: 2, defaultAfter: ['G2'] },
  { code: 'G4', stage: 'G. San xuat lo dau', name: 'Nhap kho', dept: 'PP', defaultDuration: 3, defaultAfter: ['G3'] },
];

const NODE_INDEX = Object.fromEntries(WORKFLOW_NODES.map((node) => [node.code, node]));

module.exports = { WORKFLOW_NODES, NODE_INDEX };

