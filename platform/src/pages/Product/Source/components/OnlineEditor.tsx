import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Input,
  Button,
  message,
  Space,
  Typography,
  Affix,
  List,
  Menu,
  Tag
} from 'antd';
import { remark } from 'remark';
import { toString } from 'mdast-util-to-string';
import { slugify } from 'transliteration';
import { FileTextOutlined, EditOutlined } from '@ant-design/icons';
import { EditDataType } from "@/pages/Product/Source/Upload/data";
import ReactMarkdown from 'react-markdown';

const { TextArea } = Input;
const { Title, Paragraph } = Typography;

const MOCK_EDIT_DATA: EditDataType[] = [
  {
    id: 1,
    knowledgeData: {
      '名称': '人工智能基础知识',
      '定义': '人工智能是模拟人类智能的计算机系统',
      '历史': '1956年达特茅斯会议标志着AI的诞生\n\n发展经历了多次繁荣与寒冬',
      '核心技术': '机器学习\n深度学习\n自然语言处理\n计算机视觉',
      '应用领域': '医疗诊断\n金融风控\n自动驾驶\n智能客服',
      '伦理问题': '数据隐私\n算法偏见\n就业影响\n自主武器'
    },
    metaData: {
      author: 'AI研究员',
      source: '内部知识库',
      date: '2023-05-15',
    }
  },
  {
    id: 2,
    knowledgeData: {
      '名称': '机器学习基础',
      '定义': '机器学习是让计算机从数据中学习而不需要明确编程',
      '主要类型': '监督学习\n无监督学习\n强化学习',
      '常见算法': '线性回归\n决策树\n支持向量机\n神经网络',
      '评估指标': '准确率\n精确率\n召回率\nF1分数',
      '应用场景': '推荐系统\n图像识别\n自然语言处理'
    },
    metaData: {
      author: '数据科学家',
      source: '技术文档',
      date: '2023-06-20',
    }
  }
];

interface OnlineEditorProps {
  editData?: EditDataType[];
  onSave: (editData: EditDataType) => void;
  onCancel: () => void;
}

interface Heading {
  id: string;
  title: string;
  depth: number;
  children: Heading[];
}

const OnlineEditor: React.FC<OnlineEditorProps> = ({
                                                     editData = MOCK_EDIT_DATA,
                                                     onSave,
                                                     onCancel,

                                                   }) => {
  const [currentEditData, setCurrentEditData] = useState<EditDataType>(editData ? editData[0] :null);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editContent, setEditContent] = useState<string>('');
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [collapsed, setCollapsed] = useState(false);

  const generateMarkdown = (data: Record<string, string>) => {
    let markdown = `# ${data['名称'] || '知识数据'}\n\n`;
    Object.entries(data).forEach(([key, value]) => {
      if (key !== '名称') {
        markdown += `## ${key}\n\n${value || ''}\n\n`;
      }
    });
    return markdown;
  };

  const [markdown, setMarkdown] = useState<string>(() =>
    currentEditData ? generateMarkdown(currentEditData.knowledgeData) : ''
  );

  useEffect(() => {
    if (currentEditData) {
      setMarkdown(generateMarkdown(currentEditData.knowledgeData));
      setEditingSection(null);
    }
  }, [currentEditData]);

  const handleSelectEditData = (id: number) => {
    const selectedData = editData.find(data => data.id === id);
    if (selectedData) {
      setCurrentEditData(selectedData);
    }
  };

  const startEditing = (sectionKey: string) => {
    setEditingSection(sectionKey);
    setEditContent(currentEditData.knowledgeData[sectionKey] || '');
  };

  const saveEditing = () => {
    if (!editingSection || !currentEditData) return;

    const updatedKnowledgeData = {
      ...currentEditData.knowledgeData,
      [editingSection]: editContent
    };

    const updatedEditData = {
      ...currentEditData,
      knowledgeData: updatedKnowledgeData
    };

    setCurrentEditData(updatedEditData);
    setMarkdown(generateMarkdown(updatedKnowledgeData));
    setEditingSection(null);
    message.success('修改已保存');
  };

  const cancelEditing = () => {
    setEditingSection(null);
  };

  const parseHeadings = (md: string): Heading[] => {
    const processor = remark().use(() => (tree) => {
      const headings: Heading[] = [];

      const visit = (node: any, depth = 0) => {
        if (node.type === 'heading') {
          const title = toString(node);
          const id = slugify(title) || `heading-${Math.random().toString(36).substr(2, 6)}`;

          headings.push({
            id,
            title,
            depth: node.depth,
            children: []
          });
        }

        if (node.children) {
          node.children.forEach((child: any) => visit(child, depth + 1));
        }
      };

      visit(tree);

      const nestedHeadings: Heading[] = [];
      const stack: { heading: Heading; depth: number }[] = [];

      headings.forEach(heading => {
        while (stack.length > 0 && stack[stack.length - 1].depth >= heading.depth) {
          stack.pop();
        }

        if (stack.length === 0) {
          nestedHeadings.push(heading);
        } else {
          stack[stack.length - 1].heading.children.push(heading);
        }

        stack.push({ heading, depth: heading.depth });
      });

      return nestedHeadings;
    });

    const tree = processor.parse(md);
    return processor.runSync(tree) as unknown as Heading[];
  };

  useEffect(() => {
    setHeadings(parseHeadings(markdown));
  }, [markdown]);

  const Toc = ({ headings }: { headings: Heading[] }) => {
    const handleClick = (e: React.MouseEvent, id: string) => {
      e.preventDefault();
      const element = document.getElementById(id);
      if (element) {
        const headerHeight = 64;
        const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
        window.scrollTo({
          top: elementPosition - headerHeight,
          behavior: 'smooth'
        });

        element.classList.add('heading-highlight');
        setTimeout(() => element.classList.remove('heading-highlight'), 1000);
      }
    };

    const renderHeading = (heading: Heading, level = 0) => (
      <li key={heading.id} style={{
        marginLeft: `${level * 16}px`,
        listStyle: 'none'
      }}>
        <a
          href={`#${heading.id}`}
          style={{
            color: '#1890ff',
            textDecoration: 'none',
            fontSize: `${Math.max(14 - level, 12)}px`,
            display: 'block',
            padding: '4px 0'
          }}
          onClick={(e) => handleClick(e, heading.id)}
        >
          {heading.title}
        </a>
        {heading.children.length > 0 && (
          <ul style={{ paddingLeft: 0, marginTop: 8 }}>
            {heading.children.map(child => renderHeading(child, level + 1))}
          </ul>
        )}
      </li>
    );

    return (
      <Affix
        offsetTop={100}
      >
        <div
          style={{
            width: 200,
            maxHeight: 'calc(100vh - 140px)',
            padding: 16,
            backgroundColor: 'rgba(0,0,0,0)',
            borderRadius: 4,
            zIndex: 10,
            overflowY: 'auto',
            transition: 'box-shadow 0.3s ease'
          }}
        >
          {headings.length > 0 && (
            <>
              <Title level={4} style={{ marginBottom: 16 }}>目录</Title>
              <ul style={{ paddingLeft: 0, margin: 0 }}>
                {headings.map(heading => renderHeading(heading))}
              </ul>
            </>
          )}
        </div>
      </Affix>
    );
  };

  const FileList = () => (
    <div style={{
      width: collapsed ? 80 : 250,
      height: 'calc(100vh - 64px)',
      overflowY: 'auto',
      borderRight: '1px solid #f0f0f0',
      transition: 'all 0.2s',
      backgroundColor: '#fff'
    }}>
      <div style={{
        padding: '16px 12px',
        borderBottom: '1px solid #f0f0f0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        {!collapsed && <span style={{ fontWeight: 'bold' }}>知识文件</span>}
        <Button
          type="text"
          icon={<FileTextOutlined />}
          onClick={() => setCollapsed(!collapsed)}
        />
      </div>

      {collapsed ? (
        <Menu mode="inline" selectedKeys={[currentEditData?.id.toString() || '']}>
          {editData.map(data => (
            <Menu.Item
              key={data.id}
              icon={<FileTextOutlined />}
              onClick={() => handleSelectEditData(data.id)}
            />
          ))}
        </Menu>
      ) : (
        <List
          dataSource={editData}
          renderItem={data => (
            <List.Item
              onClick={() => handleSelectEditData(data.id)}
              style={{
                padding: '12px 16px',
                cursor: 'pointer',
                backgroundColor: data.id === currentEditData?.id ? '#e6f7ff' : 'transparent',
                borderBottom: '1px solid #f0f0f0'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <FileTextOutlined style={{ marginRight: 8 }} />
                <div>
                  <div style={{ fontWeight: 'bold' }}>{data.knowledgeData['名称'] || `未命名文件 ${data.id}`}</div>
                  <div style={{ color: '#888', fontSize: 12 }}>
                    {data.metaData.author} · {data.metaData.date}
                  </div>
                </div>
              </div>
            </List.Item>
          )}
        />
      )}
    </div>
  );

  const renderMarkdownContent = () => {
    if (!currentEditData) return null;

    return (
      <div style={{ padding: 16 }}>
        <div style={{ marginBottom: 24 }}>
          <Title level={1} style={{ marginBottom: 8 }}>
            {currentEditData.knowledgeData['名称'] || '未命名文档'}
          </Title>

          <div style={{ marginBottom: 16 }}>
            <Space size={[0, 8]} wrap>
              {currentEditData.metaData.author && (
                <Tag color="blue">作者: {currentEditData.metaData.author}</Tag>
              )}
              {currentEditData.metaData.source && (
                <Tag color="green">来源: {currentEditData.metaData.source}</Tag>
              )}
              {currentEditData.metaData.date && (
                <Tag color="orange">日期: {currentEditData.metaData.date}</Tag>
              )}
              {currentEditData.metaData.tags?.map(tag => (
                <Tag key={tag}>{tag}</Tag>
              ))}
            </Space>
          </div>
        </div>

        {Object.entries(currentEditData.knowledgeData).map(([key, value]) => {
          if (key === '名称') return null;

          return (
            <div key={key} id={slugify(key)} style={{ marginBottom: 32 }}>
              <Title level={2} style={{ marginBottom: 16 }}>
                {key}
              </Title>

              {editingSection === key ? (
                <div>
                  <TextArea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    autoSize={{ minRows: 3, maxRows: 20 }}
                    style={{ marginBottom: 16 }}
                  />
                  <Space>
                    <Button type="primary" onClick={saveEditing}>
                      保存
                    </Button>
                    <Button onClick={cancelEditing}>取消</Button>
                  </Space>
                </div>
              ) : (
                <div
                  style={{
                    position: 'relative',
                    padding: 16,
                    backgroundColor: '#fafafa',
                    borderRadius: 4,
                    border: '1px dashed #d9d9d9',
                    cursor: 'pointer',
                    transition: 'all 0.3s',
                    ':hover': {
                      borderColor: '#1890ff',
                      boxShadow: '0 2px 8px rgba(24, 144, 255, 0.2)'
                    }
                  }}
                  onClick={() => startEditing(key)}
                >
                  <Paragraph style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}>
                    {value || <span style={{ color: '#bfbfbf' }}>点击添加内容...</span>}
                  </Paragraph>
                  <Button
                    type="text"
                    icon={<EditOutlined />}
                    style={{
                      position: 'absolute',
                      top: 8,
                      right: 8
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      startEditing(key);
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };


  return (
    <div style={{
      display: 'flex',
      width: 1400}}>
      <FileList />

      <div style={{flex:1, padding: '0 8px'}}>
        <Row gutter={24}>
          <Col span={18}>
            <Card
              title="知识编辑"
              style={{ marginBottom: 24 }}
              // extra={
              //   <Space>
              //     <Button type="primary" onClick={() => onSave(currentEditData)}>
              //       保存全部修改
              //     </Button>
              //     <Button onClick={onCancel}>取消</Button>
              //   </Space>
              // }
            >
              {renderMarkdownContent()}
            </Card>
          </Col>

          <Col span={6}>
            <Toc headings={headings} />
          </Col>
        </Row>
      </div>
    </div>
  );
};

export default OnlineEditor;
