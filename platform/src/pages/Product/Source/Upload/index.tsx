import React, { useRef, useState, useMemo, useCallback, useEffect } from 'react';
import {
  PageContainer,
  ProForm,
  ProFormText,
  ProFormDatePicker,
  StepsForm,
  FooterToolbar
} from '@ant-design/pro-components';
import type { FormInstance, UploadFile } from 'antd';
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Divider,
  message,
  Result,
  Row,
  Col,
  Affix,
  Upload as AntdUpload,
  Typography,
  Space,
} from 'antd';
import { FileExcelOutlined } from '@ant-design/icons';
import useStyles from './style.style';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import ReactMarkdown from 'react-markdown';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import { remark } from 'remark';
import { toString } from 'mdast-util-to-string';
import { slugify } from 'transliteration';
import { useModel } from "@umijs/max";
import type { StepDataType, EditDataType, RowDataType } from './data';
import OnlineEditor from "@/pages/Product/Source/components/OnlineEditor";

const { Title } = Typography;
const STEP_COUNT: number = 3;
const TARGET_SHEET: string = '知识源';
const TARGET_HEADER_INDEX: number = 0;
const TARGET_HEADER_NAME: string = '名称';

interface Heading {
  id: string;
  title: string;
  depth: number;
  children: Heading[];
}

const StepDescriptions: React.FC<{
  stepData: StepDataType;
  bordered?: boolean;
}> = ({ stepData, bordered }) => {
  const { editData, author, source, date } = stepData;
  return (
    <Descriptions column={1} bordered={bordered}>
      <Descriptions.Item label="数量"> {editData?.length}</Descriptions.Item>
      <Descriptions.Item label="作者"> {author}</Descriptions.Item>
      <Descriptions.Item label="来源"> {source}</Descriptions.Item>
      <Descriptions.Item label="日期"> {date}</Descriptions.Item>
    </Descriptions>
  );
};

const StepResult: React.FC<{
  onFinish: () => Promise<void>;
  children?: React.ReactNode;
}> = (props) => {
  const { styles } = useStyles();
  return (
    <Result
      status="success"
      title="上传成功"
      extra={
        <>
          <Button type="primary" onClick={props.onFinish}>
            继续
          </Button>
          <Button>查看</Button>
        </>
      }
      className={styles.result}
    >
      {props.children}
    </Result>
  );
};

const generateMarkdown = (header: string[], row: RowDataType) => {
  let markdown = `# ${row[TARGET_HEADER_NAME] || '数据预览'}\n\n`;
  let num: number = 0;
  header.forEach(col => {
    markdown += `# ${++num}.${col}\n\n`;
    markdown += `${row[col] || ''}\n\n`;
  });
  return markdown;
};

const getToc = (markdown: string): Heading[] => {
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

    // 构建嵌套结构
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

  const tree = processor.parse(markdown);
  return processor.runSync(tree) as unknown as Heading[];
};

const Toc = React.memo(({ headings }: { headings: Heading[] }) => {
  const [isAffixed, setIsAffixed] = useState(false);

  const handleClick = useCallback((e: React.MouseEvent, id: string) => {
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
  }, []);

  const renderHeading = (heading: Heading, level = 0) => (
    <li key={heading.id} style={{
      marginLeft: `${level * 16}px`,
      marginBottom: 8,
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
      onChange={(affixed) => setIsAffixed(affixed)}
    >
      <div
        style={{
          width: 200,
          maxHeight: 'calc(100vh - 140px)',
          padding: 16,
          backgroundColor: '#fff',
          borderRadius: 4,
          zIndex: 10,
          overflowY: 'auto',
          boxShadow: isAffixed ? '0 2px 8px rgba(0, 0, 0, 0.1)' : 'none',
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
});

const Upload: React.FC = () => {
  const { initialState } = useModel('@@initialState');
  const formRef = useRef<FormInstance>();
  const [current, setCurrent] = useState<number>(0);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [markdown, setMarkdown] = useState<string>('');
  const [excelData, setExcelData] = useState<RowDataType[]>([]);
  const [stepData, setStepData] = useState<StepDataType>({
    uploadData: {
      header: [],
      rows: [],
    },
    editData: [],
    metaData: {
      author: initialState?.currentUser?.name || '',
      source: '',
      date: dayjs().format('YYYY-MM-DD'),
    },
  });

  useEffect(() => {
    formRef?.current?.setFieldsValue({
      author: stepData.metaData.author,
      source: stepData.metaData.source,
      date: stepData.metaData.date,
    });
  }, [stepData.metaData]);

  const headings = useMemo(() => {
    return markdown ? getToc(markdown) : [];
  }, [markdown]);

  const parseExcel = (file: File) => {
    setIsLoading(true);
    setErrorMsg('');
    setMarkdown('');

    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          if (!workbook.SheetNames.includes(TARGET_SHEET)) {
            setErrorMsg(`Excel文件中没有找到名为"${TARGET_SHEET}"的工作表`);
            message.error(`请确保包含"${TARGET_SHEET}"工作表`);
            return reject(new Error(`Sheet "${TARGET_SHEET}" not found`));
          }

          const worksheet = workbook.Sheets[TARGET_SHEET];
          const jsonData = XLSX.utils.sheet_to_json<RowDataType>(worksheet);
          if (jsonData.length > 0) {
            const header = Object.keys(jsonData[TARGET_HEADER_INDEX]);
            const rows = jsonData.slice(TARGET_HEADER_INDEX);
            setExcelData(jsonData);
            setStepData(prev => ({
              ...prev,
              uploadData: {
                header,
                rows,
              },
              metaData: {
                ...prev.metaData,
                source: file.name
              }
            }));
            setMarkdown(generateMarkdown(header, rows[0]));
            message.success(`${file.name} 解析成功，共 ${jsonData.length} 条数据`);
          } else {
            message.warning(`"${TARGET_SHEET}"工作表中没有数据`);
          }

          resolve(jsonData);
        } catch (error) {
          console.error('解析Excel失败:', error);
          message.error(`${file.name} 解析失败`);
          reject(error);
        } finally {
          setIsLoading(false);
        }
      };
      reader.onerror = (error) => {
        console.error('文件读取失败:', error);
        message.error('文件读取失败');
        setIsLoading(false);
        reject(error);
      };
      reader.readAsArrayBuffer(file);
    });
  };
  const uploadProps = {
    accept: '.xls,.xlsx',
    multiple: false,
    required: true,
    fileList,
    onChange(info: { file: UploadFile; fileList: UploadFile[] }) {
      setFileList(info.fileList);
      if (info.file.status === 'removed') {
        setStepData(prev => ({
          ...prev,
          uploadData: {},
          metaData: {
            ...prev.metaData,
            source: '',
          }
        }));
        setErrorMsg('');
        setMarkdown('');
        formRef?.current?.resetFields();
      }
    },
    beforeUpload: (file: File) => {
      parseExcel(file)
        .then(() => {
          setFileList([{
            uid: '-1',
            name: file.name,
            status: 'done',
            url: '',
            size: file.size,
            type: file.type
          }]);
          setStepData(prev => ({
            ...prev,
            metaData: {
              ...prev.metaData, // 使用函数式更新
              source: file.name,
            }
          }));
          formRef?.current?.resetFields();
        })
        .catch(() => {
          setFileList([]);
        });

      return false;
    },
    onRemove: () => true
  };

  const handleNext = async () => {
    if (current >= STEP_COUNT) {
      console.warn("step index exceed max!")
      return;
    }
    if (excelData.length === 0) {
      message.error("请先上传并解析Excel文件");
      return;
    }
    try {
      const values = await formRef.current?.validateFields();
      setStepData(prev => {
        console.log('stepData', stepData);
        const editData = prev.uploadData.rows.map((row, index) => ({
          id: index,
          knowledgeData: row,
          metaData: {
            author: values.author || prev.metaData.author,
            source: values.source || prev.metaData.source,
            date: values.date || prev.metaData.date,
          }
        }));
        console.log('editData', editData)
        return {
          ...prev,
          editData,
          metaData: {
            author: values.author || prev.metaData.author,
            source: values.source || prev.metaData.source,
            date: values.date || prev.metaData.date,
          }
        };
      });

      setCurrent(current + 1);
    } catch (error) {
      console.error(error);
      return;
    }
  };

  const handlePrev = () => {
    if (current > 0) {
      setCurrent(current - 1);
    }
  };

  const handleSubmit = async () => {
    if (current !== STEP_COUNT - 2) {
      return
    }
    try {
      message.success('提交成功');
      formRef.current?.resetFields();
      setCurrent(current + 1);
      setExcelData([]);
      setFileList([]);
      setMarkdown('');
      setStepData(null);
    } catch (error) {
      console.error(error);
      message.error('提交失败');
    }
  };

  return (
    <PageContainer>
      <Card variant="borderless">
        <StepsForm
          current={current}
          onCurrentChange={setCurrent}
          formRef={formRef}
          submitter={{
            render: () => null,
          }}
        >
          <StepsForm.StepForm title="上传">
            <Row gutter={24}>
              <Col span={8}>
                <Card title="设置" style={{ marginBottom: 24 }}>
                  <Alert
                    message="请上传模板Excel文件"
                    type="info"
                    showIcon
                    style={{ marginBottom: 24 }}
                  />

                  {errorMsg && (
                    <Alert
                      message={errorMsg}
                      type="error"
                      showIcon
                      style={{ marginBottom: 24 }}
                    />
                  )}

                  <div style={{ marginBottom: 24 }}>
                    <AntdUpload.Dragger {...uploadProps} disabled={isLoading}>
                      <p className="ant-upload-drag-icon">
                        <FileExcelOutlined style={{ fontSize: 48, color: '#1890ff' }}/>
                      </p>
                      <p className="ant-upload-text">
                        点击或拖拽Excel文件到此处
                      </p>
                      <p className="ant-upload-hint">
                        支持.xls和.xlsx格式
                      </p>
                    </AntdUpload.Dragger>
                  </div>

                  <ProForm.Group>
                    <ProFormText
                      name="author"
                      label="作者"
                      width="md"
                      rules={[{ message: '请输入作者' }]}
                      placeholder="请输入作者名称"
                      initialValue={stepData.metaData?.author}
                    />
                    <ProFormText
                      name="source"
                      label="来源"
                      width="md"
                      rules={[{ message: '请输入来源' }]}
                      placeholder="请输入数据来源"
                      initialValue={stepData.metaData?.source}
                    />
                    <ProFormDatePicker
                      name="date"
                      label="日期"
                      width="md"
                      rules={[{ message: '请选择日期' }]}
                      fieldProps={{
                        format: 'YYYY-MM-DD',
                      }}
                      initialValue={stepData.metaData?.date}
                    />
                  </ProForm.Group>
                </Card>
              </Col>

              <Col span={16}>
                <Card title="预览" style={{ marginBottom: 24 }}>
                  <Row gutter={24}>
                    <Col span={18}>
                      {markdown ? (
                        <div style={{
                          padding: 16,
                          border: '1px solid #f0f0f0',
                          borderRadius: 4,
                          maxHeight: 600,
                          overflow: 'auto'
                        }}>
                          <ReactMarkdown
                            rehypePlugins={[
                              rehypeSlug,
                              [rehypeAutolinkHeadings, { behavior: 'wrap' }]
                            ]}
                          >
                            {markdown}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <div style={{
                          padding: 16,
                          border: '1px dashed #d9d9d9',
                          borderRadius: 4,
                          textAlign: 'center',
                          color: '#999'
                        }}>
                          <FileExcelOutlined style={{ fontSize: 48, marginBottom: 16 }}/>
                          <p>请上传Excel文件预览数据</p>
                        </div>
                      )}
                    </Col>
                    <Col span={6}>
                      <Toc headings={headings}/>
                    </Col>
                  </Row>
                </Card>
              </Col>
            </Row>
          </StepsForm.StepForm>

          <StepsForm.StepForm title="编辑" style={{padding:0}}>
                <OnlineEditor editData={stepData.editData}></OnlineEditor>
          </StepsForm.StepForm>

          <StepsForm.StepForm title="完成">
            <StepResult
              onFinish={async () => {
                setCurrent(0);
                formRef.current?.resetFields();
                setExcelData([]);
                setFileList([]);
                setMarkdown('');
              }}
            >
              <StepDescriptions stepData={stepData}/>
            </StepResult>
          </StepsForm.StepForm>
        </StepsForm>

        <FooterToolbar style={{ position: 'fixed', bottom: 0, right: 0, zIndex: 999 }}>
          <Space size="large">
            {current < STEP_COUNT - 1 && (
              <>
                {current > 0 && (
                  <Button onClick={handlePrev} disabled={current === 0 || current === 2}>
                    上一步
                  </Button>
                )}
                <Button type="primary" onClick={current < STEP_COUNT - 1 ? handleNext : handleSubmit}
                        loading={isLoading}>
                  {current === 0 ? '下一步' : '提交'}
                </Button>
              </>
            )}
          </Space>
        </FooterToolbar>

        <Divider style={{ margin: '40px 0 24px' }}/>

        <div>
          <h3>说明</h3>
          <h4>知识上传</h4>
          <p>
            1. 必须包含名为"知识源"的工作表<br/>
            2. 仅支持指定模板Excel上传<br/>
            3. 文件大小不超过10MB<br/>
            4. 最多支持1000条数据批量上传<br/>
            5. 请确保数据格式正确<br/>
            6. 需要填写作者、来源和日期信息
          </p>
        </div>
      </Card>
    </PageContainer>
  );
};

export default Upload;
